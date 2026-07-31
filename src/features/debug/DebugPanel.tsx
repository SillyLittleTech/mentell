import { useEffect, useMemo, useState } from 'react'
import { addDays } from 'date-fns'
import { getDb } from '../../db/schema'
import { makeId } from '../../shared/id'
import {
  getForcePackages,
  getSkipAiCache,
  getSkipSearchRateLimit,
  getSlowMo,
  isDebugMode,
  setForcePackages,
  setSkipAiCache,
  setSkipSearchRateLimit,
  setSlowMo,
} from '../../shared/debug/debugFlags'
import { useOnlineStatus } from '../../shared/offline/useOnlineStatus'
import { setForcedOnlineStatus } from '../../shared/offline/onlineStatus'
import { clearWeeklyAiCache } from '../compilation/weeklyAiCache'
import { weekKeyForDateKey } from '../compilation/weeklyStats'
import { ensurePackage } from '../packages/packageService'
import { clearCatCollection } from '../shop/catCollection'
import { clearShopInventory } from '../shop/shopInventory'
import { notifyScoreChanged } from '../score/scoreEvents'
import { assessRisk } from '../safety/riskAssessment'
import {
  debugForegroundNotification,
  debugRequestNotificationPermission,
  debugRunPackageDeliveryNotify,
  debugScheduleDelayedForeground,
  debugUnregisterServiceWorker,
  debugWaitForServiceWorker,
  getNotificationDebugSnapshot,
  sendWorkerPushTest,
  sendWorkerPushTestDelayed,
  syncPushSubscriptionWithResult,
  unsubscribePush,
  type NotificationDebugSnapshot,
} from './debugNotifications'
import { dexieDatabaseName, scopedStorageKey } from '../../shared/storage/storageScope'
import { normalizeEndpointUrl } from '../compilation/weeklyAiSummary'
import {
  getOrCreateAnonSearchUserId,
  loadAllEntriesForSearch,
  probeProjectorSearchEndpoint,
  requestProjectorSearch,
  toSearchSnapshot,
} from '../compilation/projectorSearch'
import { useAuthOptional } from '../../shared/firebase/authContext'
import {
  emitProjectorDebug,
  makeMockSearchAnswer,
  makeMockSearchEntries,
} from './projectorDebug'
import { dateKeyForLocalDay } from '../../shared/dates'
import { notifyLocalDataChanged } from '../../shared/sync/localDataEvents'

const DEBUG_AI_TESTS = [
  {
    id: 'CRISIS',
    label: 'SENT_TRIGGER_CRISIS',
    reason: 'I am afraid I might hurt myself tonight',
    sentiment: '-' as const,
    emotion: 'sad' as const,
  },
  {
    id: 'SUPPORT',
    label: 'SENT_TRIGGER_SUPPORT',
    reason: 'a negative interaction made me feel overwhelmed and alone',
    sentiment: '-' as const,
    emotion: 'anxious' as const,
  },
  {
    id: 'EXEC',
    label: 'SENT_TRIGGER_EXEC',
    reason: 'I nailed something important and feel proud of myself',
    sentiment: '+' as const,
    emotion: 'happy' as const,
  },
]

export function DebugPanel() {
  const enabled = useMemo(() => isDebugMode(), [])
  const auth = useAuthOptional()
  const isOnline = useOnlineStatus()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [slowMo, setSlowMoState] = useState(getSlowMo())
  const [forcePackages, setForcePackagesState] = useState(getForcePackages())
  const [skipAiCache, setSkipAiCacheState] = useState(getSkipAiCache())
  const [skipSearchRate, setSkipSearchRateState] = useState(getSkipSearchRateLimit())
  const [debugScore, setDebugScore] = useState('')
  const [debugStreak, setDebugStreak] = useState('')
  const [notifSnap, setNotifSnap] = useState<NotificationDebugSnapshot | null>(null)
  const [notifResult, setNotifResult] = useState<string | null>(null)
  const [aiEndpointResult, setAiEndpointResult] = useState<string | null>(null)
  const [searchDebugResult, setSearchDebugResult] = useState<string | null>(null)
  const [fetchEntryIds, setFetchEntryIds] = useState('')
  const [fetchedEntriesPreview, setFetchedEntriesPreview] = useState<string | null>(null)
  const [riskProbeText, setRiskProbeText] = useState('death')
  const [riskProbeResult, setRiskProbeResult] = useState<string | null>(null)
  const [pushDelaySec, setPushDelaySec] = useState(30)
  const [inspector, setInspector] = useState<{
    entries: number
    notes: number
    stickies: number
    packages: number
    scoreTotal: string | null
    scoreStreak: string | null
    lastDay: string | null
    streakFreezes: string | null
    streakRestore: string | null
    recentEntries: Array<{ dateKey: string; sentiment: string; warningLevel: string }>
    recentPackages: Array<{ kind: string; periodKey: string; opened: boolean }>
  } | null>(null)

  async function refreshInspector() {
    const database = getDb()
    const [entries, notes, stickies, packages] = await Promise.all([
      database.entries.count(),
      database.notes.count(),
      database.stickies.count(),
      database.packages.count(),
    ])

    const recentEntriesRows = await database.entries.orderBy('createdAt').reverse().limit(6).toArray()
    const recentPackagesRows = await database.packages.orderBy('createdAt').reverse().limit(6).toArray()

    setInspector({
      entries,
      notes,
      stickies,
      packages,
      scoreTotal: localStorage.getItem(scopedStorageKey('mentell.score.total')),
      scoreStreak: localStorage.getItem(scopedStorageKey('mentell.score.streak')),
      lastDay: localStorage.getItem(scopedStorageKey('mentell.score.lastDay')),
      streakFreezes: localStorage.getItem(scopedStorageKey('mentell.score.streakFreezes')),
      streakRestore: localStorage.getItem(scopedStorageKey('mentell.score.streakRestore')),
      recentEntries: recentEntriesRows.map((e) => ({
        dateKey: e.dateKey,
        sentiment: e.sentiment,
        warningLevel: e.warningLevel,
      })),
      recentPackages: recentPackagesRows.map((p) => ({
        kind: p.kind,
        periodKey: p.periodKey,
        opened: Boolean(p.openedAt),
      })),
    })
  }

  async function refreshNotifications() {
    setNotifSnap(await getNotificationDebugSnapshot())
  }

  async function ensureLatestEntryWeeklyPackage() {
    const latestEntry = await getDb().entries.orderBy('dateKey').last()
    const periodKey = latestEntry ? weekKeyForDateKey(latestEntry.dateKey) : `debug-W${Date.now()}`
    await ensurePackage('weekly', periodKey)
  }

  async function checkAiEndpoint() {
    const endpoint = import.meta.env.VITE_WEEKLY_AI_ENDPOINT
    if (typeof endpoint !== 'string' || !endpoint.trim()) {
      setAiEndpointResult('AI endpoint: VITE_WEEKLY_AI_ENDPOINT is not set.')
      return
    }
    const normalizedEndpoint = normalizeEndpointUrl(endpoint)
    setAiEndpointResult(`Checking ${normalizedEndpoint}…`)
    try {
      const response = await fetch(normalizedEndpoint, { method: 'OPTIONS' })
      const routeHint = normalizedEndpoint.endsWith('/weekly-summary')
        ? ''
        : ' Expected the Worker /weekly-summary route.'
      const normalizedHint =
        normalizedEndpoint === endpoint ? '' : ` Normalized from ${endpoint}.`
      const okHint =
        response.status === 204 || response.ok
          ? 'ok'
          : response.status === 405
            ? 'method not allowed; endpoint may be the wrong route'
            : 'unexpected status'
      setAiEndpointResult(
        `AI endpoint ${okHint} (${response.status}).${routeHint}${normalizedHint}`,
      )
    } catch (e) {
      setAiEndpointResult(`AI endpoint check failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  function fillAiTest(test: (typeof DEBUG_AI_TESTS)[number]) {
    window.dispatchEvent(
      new CustomEvent('mentell:debug-ai-test-fill', {
        detail: {
          sentiment: test.sentiment,
          emotion: test.emotion,
          emotionNote: '',
          situation: `${test.label}(${test.reason})`,
          details: 'Debug AI intervention trigger. Submit this letter to exercise the worker classifier.',
        },
      }),
    )
    setOpen(false)
  }

  async function runRiskProbe() {
    setBusy(true)
    setRiskProbeResult('Running risk workflow…')
    try {
      const risk = await assessRisk(
        {
          dateKey: dateKeyForLocalDay(new Date()),
          sentiment: '=',
          emotion: 'other',
          emotionNote: '',
          situation: '',
          details: riskProbeText,
        },
        { forceAi: true },
      )
      const lines = [
        `literal=${risk.literalSentimentLabel} ${risk.literalSentimentConfidence.toFixed(2)} (${risk.literalSentimentScore.toFixed(2)})`,
        `semantic=${risk.semanticRiskLabel} ${risk.semanticRiskConfidence.toFixed(2)} source=${risk.semanticRiskSource}`,
        `response=${risk.responseKind} warning=${risk.warningLevel} risk=${risk.riskScore.toFixed(2)} level=${risk.riskLevel}`,
        `source=${risk.source} model=${risk.sentimentModelSource} guard=${risk.guardSafe === undefined ? 'n/a' : risk.guardSafe ? 'safe' : 'unsafe'}`,
        risk.guardCategories?.length ? `guard categories=${risk.guardCategories.join(', ')}` : '',
        risk.flaggedTerms.length ? `flags=${risk.flaggedTerms.join(', ')}` : '',
        risk.reasons.length ? `reasons=${risk.reasons.join(', ')}` : '',
        risk.supportiveMessage ? `message=${risk.supportiveMessage}` : '',
      ].filter(Boolean)
      setRiskProbeResult(lines.join('\n'))
    } catch (e) {
      setRiskProbeResult(`Risk workflow failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!enabled || !open) return
    const t = window.setTimeout(() => {
      refreshInspector()
      void refreshNotifications()
    }, 0)
    return () => window.clearTimeout(t)
  }, [enabled, open])

  useEffect(() => {
    if (!open || !notifSnap) return
    if (notifSnap.serviceWorkerReady) return
    if (notifSnap.serviceWorkerState !== 'installing' && !notifSnap.serviceWorkerRegistered) return
    const id = window.setInterval(() => void refreshNotifications(), 2000)
    return () => window.clearInterval(id)
  }, [open, notifSnap])

  async function runNotifAction(
    label: string,
    fn: () => Promise<{ ok: boolean; detail: string; status?: number }>,
  ) {
    setBusy(true)
    setNotifResult(`${label}…`)
    try {
      const res = await fn()
      const status = res.status ? ` (${res.status})` : ''
      setNotifResult(`${label}: ${res.ok ? 'ok' : 'fail'}${status} — ${res.detail}`)
      await refreshNotifications()
    } catch (e) {
      setNotifResult(`${label}: error — ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!enabled) return null

  return (
    <>
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/25"
          aria-label="Close debug panel"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div className="fixed bottom-5 left-5 z-40 flex max-h-[min(85dvh,calc(100dvh-2.5rem))] flex-col items-start justify-end">
        {open ? (
          <div
            className="paper flex max-h-full w-[min(360px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-3xl shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="debug-panel-title"
          >
            <div className="shrink-0 border-b border-[var(--paper-border)] p-4">
              <div className="flex items-center justify-between gap-2">
                <div id="debug-panel-title" className="font-mono text-sm font-bold">
                  debug
                </div>
                <button
                  type="button"
                  className="focus-ring rounded-xl border border-[var(--paper-border)] px-3 py-1.5 text-xs font-semibold"
                  onClick={() => setOpen(false)}
                >
                  Close
                </button>
              </div>
              <div className="ink-muted mt-1 text-xs">
                Isolated debug storage ({dexieDatabaseName()}) · Esc or backdrop to dismiss
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
              <div className="grid gap-2">
            <div className="rounded-3xl border border-[var(--paper-border)] p-3">
              <div className="font-mono text-xs font-bold">ui toggles</div>
              <div className="mt-2 grid gap-2">
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>Slow‑mo animations</span>
                  <select
                    className="focus-ring rounded-2xl border border-[var(--paper-border)] bg-transparent px-3 py-2 text-xs"
                    value={slowMo}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      setSlowMo(v)
                      setSlowMoState(v)
                    }}
                  >
                    <option value={0.5}>0.5x</option>
                    <option value={1}>1x</option>
                    <option value={2}>2x</option>
                    <option value={4}>4x</option>
                  </select>
                </label>

                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>Force package alert</span>
                  <input
                    type="checkbox"
                    checked={forcePackages}
                    onChange={(e) => {
                      setForcePackages(e.target.checked)
                      setForcePackagesState(e.target.checked)
                    }}
                  />
                </label>

                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>Skip AI summary cache</span>
                  <input
                    type="checkbox"
                    checked={skipAiCache}
                    onChange={(e) => {
                      setSkipAiCache(e.target.checked)
                      setSkipAiCacheState(e.target.checked)
                    }}
                  />
                </label>

                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>Skip search rate limit</span>
                  <input
                    type="checkbox"
                    checked={skipSearchRate}
                    onChange={(e) => {
                      setSkipSearchRateLimit(e.target.checked)
                      setSkipSearchRateState(e.target.checked)
                    }}
                  />
                </label>

                <button
                  type="button"
                  disabled={busy}
                  className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                  onClick={() => void checkAiEndpoint()}
                >
                  Check AI endpoint
                  <div className="ink-muted text-xs">
                    Verifies VITE_WEEKLY_AI_ENDPOINT and the /weekly-summary route.
                  </div>
                </button>
                {aiEndpointResult ? (
                  <div className="ink-muted rounded-2xl border border-[var(--paper-border)] px-3 py-2 font-mono text-[10px]">
                    {aiEndpointResult}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--paper-border)] p-3">
              <div className="font-mono text-xs font-bold">projector / AI search</div>
              <div className="mt-2 grid gap-2">
                <button
                  type="button"
                  disabled={busy}
                  className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                  onClick={() => {
                    setBusy(true)
                    void probeProjectorSearchEndpoint()
                      .then((r) => setSearchDebugResult(r))
                      .finally(() => setBusy(false))
                  }}
                >
                  Check search endpoint
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                  onClick={() => {
                    setBusy(true)
                    void (async () => {
                      try {
                        const entries = await loadAllEntriesForSearch()
                        const res = await requestProjectorSearch({
                          query: '',
                          mode: 'index',
                          entries,
                          userId: auth?.user?.uid || getOrCreateAnonSearchUserId(),
                          forceIndex: true,
                          skipRateLimit: true,
                        })
                        setSearchDebugResult(
                          res.type === 'error'
                            ? res.message
                            : res.type === 'answer'
                              ? res.text
                              : `Indexed; got ${res.entries.length} entries back`,
                        )
                      } catch (e) {
                        setSearchDebugResult(e instanceof Error ? e.message : String(e))
                      } finally {
                        setBusy(false)
                      }
                    })()
                  }}
                >
                  Force index sync
                  <div className="ink-muted text-xs">POST mode=index with all Dexie entries</div>
                </button>
                <button
                  type="button"
                  className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm"
                  onClick={() => {
                    emitProjectorDebug({ action: 'open-search', seed: makeMockSearchEntries() })
                    setOpen(false)
                  }}
                >
                  Render mock entry cards
                </button>
                <button
                  type="button"
                  className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm"
                  onClick={() => {
                    emitProjectorDebug({ action: 'open-search', seed: makeMockSearchAnswer() })
                    setOpen(false)
                  }}
                >
                  Render mock plain answer
                </button>
                <div className="grid gap-1">
                  <input
                    className="focus-ring rounded-2xl border border-[var(--paper-border)] bg-transparent px-3 py-2 text-xs"
                    placeholder="entry ids, comma-separated"
                    value={fetchEntryIds}
                    onChange={(e) => setFetchEntryIds(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                    onClick={() => {
                      setBusy(true)
                      void (async () => {
                        try {
                          const ids = fetchEntryIds
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean)
                          const rows = await getDb().entries.bulkGet(ids)
                          const found = rows.filter(Boolean).map((r) => toSearchSnapshot(r!))
                          setFetchedEntriesPreview(
                            found.length
                              ? found.map((e) => `${e.id} ${e.dateKey} [${e.sentiment}]`).join('\n')
                              : 'No matching local entries.',
                          )
                          if (found.length) {
                            emitProjectorDebug({
                              action: 'open-search',
                              seed: {
                                type: 'entries',
                                entryIds: found.map((e) => e.id),
                                entries: found,
                                preamble: 'Debug fetch by entry IDs (local Dexie).',
                              },
                            })
                            setOpen(false)
                          }
                        } catch (e) {
                          setFetchedEntriesPreview(e instanceof Error ? e.message : String(e))
                        } finally {
                          setBusy(false)
                        }
                      })()
                    }}
                  >
                    Fetch by entry IDs
                  </button>
                </div>
                {searchDebugResult ? (
                  <div className="ink-muted rounded-2xl border border-[var(--paper-border)] px-3 py-2 font-mono text-[10px]">
                    {searchDebugResult}
                  </div>
                ) : null}
                {fetchedEntriesPreview ? (
                  <div className="ink-muted rounded-2xl border border-[var(--paper-border)] px-3 py-2 font-mono text-[10px] whitespace-pre-wrap">
                    {fetchedEntriesPreview}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--paper-border)] p-3">
              <div className="font-mono text-xs font-bold">AI response tests</div>
              <div className="ink-muted mt-1 text-xs">
                Fills the composer with debug-only sentinel input. Parentheses become the generated emotion reason.
              </div>
              <div className="mt-2 grid gap-2">
                {DEBUG_AI_TESTS.map((test) => (
                  <button
                    key={test.id}
                    type="button"
                    disabled={busy}
                    className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                    onClick={() => fillAiTest(test)}
                  >
                    {test.label}
                    <div className="ink-muted text-xs">({test.reason})</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--paper-border)] p-3">
              <div className="font-mono text-xs font-bold">risk workflow probe</div>
              <div className="mt-2 grid gap-2">
                <textarea
                  className="focus-ring min-h-20 w-full resize-y rounded-2xl border border-[var(--paper-border)] bg-transparent px-3 py-2 font-paper text-sm"
                  value={riskProbeText}
                  onChange={(e) => setRiskProbeText(e.target.value)}
                />
                <div className="grid grid-cols-3 gap-2">
                  {['death', 'kill', 'I want to kill myself'].map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      disabled={busy}
                      className="focus-ring rounded-2xl border border-[var(--paper-border)] px-2 py-2 text-xs disabled:opacity-60"
                      onClick={() => setRiskProbeText(sample)}
                    >
                      {sample}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={busy}
                  className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                  onClick={() => void runRiskProbe()}
                >
                  Run risk workflow
                  <div className="ink-muted text-xs">
                    Uses the local sentiment model and Worker guard when configured.
                  </div>
                </button>
                {riskProbeResult ? (
                  <pre className="ink-muted whitespace-pre-wrap rounded-2xl border border-[var(--paper-border)] p-3 font-mono text-[10px]">
                    {riskProbeResult}
                  </pre>
                ) : null}
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--paper-border)] p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono text-xs font-bold">notifications</div>
                <button
                  type="button"
                  disabled={busy}
                  className="focus-ring rounded-xl border border-[var(--paper-border)] px-2 py-1 text-xs disabled:opacity-60"
                  onClick={() => void refreshNotifications()}
                >
                  refresh
                </button>
              </div>
              {notifSnap ? (
                <dl className="ink-muted mt-2 grid gap-1 font-mono text-[10px] leading-snug">
                  <div>
                    <dt className="inline">permission </dt>
                    <dd className="inline text-[var(--ink)]">{notifSnap.permission}</dd>
                  </div>
                  <div>
                    <dt className="inline">in-app enabled </dt>
                    <dd className="inline text-[var(--ink)]">
                      {notifSnap.enabledInApp ? 'yes' : 'no'}
                      {notifSnap.disableNotifications ? ' (disabled in settings)' : ''}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline">push env </dt>
                    <dd className="inline text-[var(--ink)]">
                      {notifSnap.webPushEnvConfigured ? 'configured' : 'missing'}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline">worker VAPID </dt>
                    <dd className="inline text-[var(--ink)]">
                      {notifSnap.workerVapidConfigured === null
                        ? 'unknown'
                        : notifSnap.workerVapidConfigured
                          ? 'ready'
                          : 'missing (.dev.vars)'}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline">service worker </dt>
                    <dd className="inline text-[var(--ink)]">
                      {notifSnap.serviceWorkerReady
                        ? 'ready'
                        : notifSnap.serviceWorkerRegistered
                          ? notifSnap.serviceWorkerState
                          : 'none'}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline">push subscription </dt>
                    <dd className="inline text-[var(--ink)]">
                      {notifSnap.pushSubscriptionActive ? 'yes' : 'no'}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline">delivery </dt>
                    <dd className="inline text-[var(--ink)]">
                      wd={notifSnap.deliveryWeekday} {notifSnap.deliveryTimeLocal}{' '}
                      {notifSnap.timezone}
                    </dd>
                  </div>
                  {notifSnap.pushApiBase ? (
                    <div className="break-all">
                      <dt className="inline">api </dt>
                      <dd className="inline text-[var(--ink)]">{notifSnap.pushApiBase}</dd>
                    </div>
                  ) : null}
                  {notifSnap.serviceWorkerNote ? (
                    <p className="mt-1 text-[var(--ink)]">{notifSnap.serviceWorkerNote}</p>
                  ) : null}
                </dl>
              ) : (
                <p className="ink-muted mt-2 text-xs">Loading…</p>
              )}
              {notifResult ? (
                <p className="mt-2 break-words font-mono text-[10px] leading-snug text-[var(--ink)]">
                  {notifResult}
                </p>
              ) : null}
              <div className="mt-2 grid gap-2">
                <button
                  type="button"
                  disabled={busy}
                  className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                  onClick={() =>
                    void runNotifAction('permission', () => debugRequestNotificationPermission())
                  }
                >
                  Request permission + subscribe
                  <div className="ink-muted text-xs">Prompts OS permission; syncs push if env is set.</div>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                  onClick={() =>
                    void runNotifAction('foreground', async () => debugForegroundNotification())
                  }
                >
                  Foreground test notification
                  <div className="ink-muted text-xs">Uses Notification API while tab is open.</div>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                  onClick={() =>
                    void runNotifAction('delivery', () => debugRunPackageDeliveryNotify())
                  }
                >
                  Run package delivery + notify
                </button>
                <label className="grid gap-1 text-sm">
                  <span className="ink-muted text-xs font-medium">Delayed test (seconds)</span>
                  <select
                    className="focus-ring rounded-2xl border border-[var(--paper-border)] bg-transparent px-3 py-2 text-xs"
                    value={pushDelaySec}
                    onChange={(e) => setPushDelaySec(Number(e.target.value))}
                  >
                    <option value={3}>3</option>
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={30}>30</option>
                    <option value={45}>45</option>
                    <option value={60}>60</option>
                    <option value={90}>90</option>
                  </select>
                </label>
                <button
                  type="button"
                  disabled={busy || !notifSnap?.webPushEnvConfigured}
                  className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                  onClick={() =>
                    void runNotifAction('delayed push', () =>
                      sendWorkerPushTestDelayed(pushDelaySec),
                    )
                  }
                >
                  Schedule delayed push (close tab OK)
                  <div className="ink-muted text-xs">
                    Worker sends Web Push after the delay — best test for Safari background
                    behavior. Sync push first.
                  </div>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                  onClick={() =>
                    void runNotifAction('delayed foreground', async () =>
                      debugScheduleDelayedForeground(pushDelaySec),
                    )
                  }
                >
                  Schedule delayed foreground
                  <div className="ink-muted text-xs">
                    Same delay, but uses Notification API — tab must stay open; Safari may
                    suppress while focused.
                  </div>
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    className="focus-ring rounded-2xl border border-[var(--paper-border)] px-2 py-2 text-xs font-medium disabled:opacity-60"
                    onClick={() =>
                      void runNotifAction('wait for SW', () => debugWaitForServiceWorker())
                    }
                  >
                    Wait for SW
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="focus-ring rounded-2xl border border-[var(--paper-border)] px-2 py-2 text-xs font-medium disabled:opacity-60"
                    onClick={() =>
                      void runNotifAction('unregister SW', () => debugUnregisterServiceWorker())
                    }
                  >
                    Unregister SW
                  </button>
                  <button
                    type="button"
                    disabled={busy || !notifSnap?.webPushEnvConfigured}
                    className="focus-ring rounded-2xl border border-[var(--paper-border)] px-2 py-2 text-xs font-medium disabled:opacity-60"
                    onClick={() =>
                      void runNotifAction('subscribe', () => syncPushSubscriptionWithResult())
                    }
                  >
                    Sync push (worker)
                  </button>
                  <button
                    type="button"
                    disabled={busy || !notifSnap?.webPushEnvConfigured}
                    className="focus-ring rounded-2xl border border-[var(--paper-border)] px-2 py-2 text-xs font-medium disabled:opacity-60"
                    onClick={() => void runNotifAction('push test', () => sendWorkerPushTest())}
                  >
                    Worker /push/test
                  </button>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                  onClick={() =>
                    void runNotifAction('unsubscribe', async () => {
                      await unsubscribePush()
                      return { ok: true, detail: 'Unsubscribed locally + worker' }
                    })
                  }
                >
                  Unsubscribe push
                  <div className="ink-muted text-xs">
                    If SW was stuck on installing: Unregister SW → reload → Wait for SW → Sync push.
                    Close tab after /push/test for background push.
                  </div>
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--paper-border)] p-3">
              <div className="font-mono text-xs font-bold">packages</div>
              <div className="mt-2 grid gap-2">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    className="focus-ring rounded-2xl border border-[var(--paper-border)] px-2 py-2 text-xs font-medium disabled:opacity-60"
                    onClick={async () => {
                      setBusy(true)
                      try {
                        await ensureLatestEntryWeeklyPackage()
                        await refreshInspector()
                      } finally {
                        setBusy(false)
                      }
                    }}
                  >
                    add weekly
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="focus-ring rounded-2xl border border-[var(--paper-border)] px-2 py-2 text-xs font-medium disabled:opacity-60"
                    onClick={async () => {
                      setBusy(true)
                      try {
                        await ensurePackage('monthly', `debug-M${Date.now()}`)
                        await refreshInspector()
                      } finally {
                        setBusy(false)
                      }
                    }}
                  >
                    add monthly
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="focus-ring rounded-2xl border border-[var(--paper-border)] px-2 py-2 text-xs font-medium disabled:opacity-60"
                    onClick={async () => {
                      setBusy(true)
                      try {
                        await ensurePackage('yearly', `debug-Y${Date.now()}`)
                        await refreshInspector()
                      } finally {
                        setBusy(false)
                      }
                    }}
                  >
                    add yearly
                  </button>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                  onClick={async () => {
                    // simulate “delivery” by creating unopened packages at once
                    setBusy(true)
                    try {
                      await ensureLatestEntryWeeklyPackage()
                      await ensurePackage('monthly', `debug-batch-M${Date.now()}`)
                      await ensurePackage('yearly', `debug-batch-Y${Date.now()}`)
                      await refreshInspector()
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  Drop a batch (W/M/Y)
                  <div className="ink-muted text-xs">Triggers alert escalation + truck.</div>
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--paper-border)] p-3">
              <div className="font-mono text-xs font-bold">score / streak</div>
              <div className="mt-2 grid gap-2">
                <label className="grid gap-1 text-xs">
                  <span className="ink-muted">Total score</span>
                  <input
                    type="number"
                    min={0}
                    className="focus-ring rounded-xl border border-[var(--paper-border)] bg-transparent px-3 py-2 font-mono"
                    value={debugScore}
                    placeholder={inspector?.scoreTotal ?? '0'}
                    onChange={(e) => setDebugScore(e.target.value)}
                  />
                </label>
                <label className="grid gap-1 text-xs">
                  <span className="ink-muted">Streak</span>
                  <input
                    type="number"
                    min={0}
                    className="focus-ring rounded-xl border border-[var(--paper-border)] bg-transparent px-3 py-2 font-mono"
                    value={debugStreak}
                    placeholder={inspector?.scoreStreak ?? '0'}
                    onChange={(e) => setDebugStreak(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  disabled={busy}
                  className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                  onClick={async () => {
                    setBusy(true)
                    try {
                      const totalRaw = debugScore.trim() || inspector?.scoreTotal || '0'
                      const streakRaw = debugStreak.trim() || inspector?.scoreStreak || '0'
                      const total = Math.max(0, Math.trunc(Number(totalRaw)) || 0)
                      const streak = Math.max(0, Math.trunc(Number(streakRaw)) || 0)
                      localStorage.setItem(scopedStorageKey('mentell.score.total'), String(total))
                      localStorage.setItem(scopedStorageKey('mentell.score.streak'), String(streak))
                      notifyScoreChanged()
                      notifyLocalDataChanged()
                      setDebugScore('')
                      setDebugStreak('')
                      await refreshInspector()
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  Apply score &amp; streak
                  <div className="ink-muted text-xs">Updates localStorage, top bar, and cloud sync.</div>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                  onClick={async () => {
                    setBusy(true)
                    try {
                      const missedDay = dateKeyForLocalDay(addDays(new Date(), -2))
                      localStorage.setItem(scopedStorageKey('mentell.score.lastDay'), missedDay)
                      localStorage.removeItem(scopedStorageKey('mentell.score.streakRestore'))
                      notifyScoreChanged()
                      notifyLocalDataChanged()
                      await refreshInspector()
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  Simulate missed day
                  <div className="ink-muted text-xs">
                    Sets lastDay to two days ago; next submit tests freeze/break behavior.
                  </div>
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--paper-border)] p-3">
              <div className="font-mono text-xs font-bold">network state</div>
              <div className="mt-2 grid gap-2">
                <button
                  type="button"
                  className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm"
                  onClick={() => {
                    setForcedOnlineStatus(!isOnline)
                  }}
                >
                  Toggle network state (currently {isOnline ? 'online' : 'offline'})
                  <div className="ink-muted text-xs">
                    Forces app online/offline for QA (does not change the browser network).
                  </div>
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--paper-border)] p-3">
              <div className="font-mono text-xs font-bold">storage inspector</div>
              <div className="mt-2 grid gap-2">
                <button
                  type="button"
                  disabled={busy}
                  className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                  onClick={async () => {
                    setBusy(true)
                    try {
                      await refreshInspector()
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  Refresh inspector
                </button>

                {inspector ? (
                  <div className="ink-muted rounded-2xl border border-[var(--paper-border)] p-3 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>entries: {inspector.entries}</div>
                      <div>packages: {inspector.packages}</div>
                      <div>notes: {inspector.notes}</div>
                      <div>stickies: {inspector.stickies}</div>
                    </div>
                    <div className="mt-2">
                      score: {inspector.scoreTotal ?? '0'} (streak {inspector.scoreStreak ?? '0'})
                    </div>
                    <div className="mt-1">
                      last day: {inspector.lastDay ?? '—'} · freezes:{' '}
                      {inspector.streakFreezes ?? '0'} · restore:{' '}
                      {inspector.streakRestore ? 'yes' : 'no'}
                    </div>
                    <div className="mt-2">
                      recent entries:
                      {inspector.recentEntries.length ? (
                        <ul className="mt-1 list-disc pl-4">
                          {inspector.recentEntries.map((e) => (
                            <li key={`${e.dateKey}-${e.sentiment}`}>
                              {e.dateKey} [{e.sentiment}] {e.warningLevel === 'warn' ? '(!)' : ''}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="mt-1">—</div>
                      )}
                    </div>
                    <div className="mt-2">
                      recent packages:
                      {inspector.recentPackages.length ? (
                        <ul className="mt-1 list-disc pl-4">
                          {inspector.recentPackages.map((p) => (
                            <li key={`${p.kind}-${p.periodKey}`}>
                              {p.kind} {p.periodKey} {p.opened ? '(opened)' : '(new)'}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="mt-1">—</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="ink-muted text-xs">No snapshot yet.</div>
                )}
              </div>
            </div>

            <button
              type="button"
              disabled={busy}
              className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
              onClick={() => {
                clearWeeklyAiCache()
              }}
            >
              Clear AI summary cache
              <div className="ink-muted text-xs">Forces fresh Worker calls on next generate.</div>
            </button>

            <button
              type="button"
              disabled={busy}
              className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
              onClick={() => {
                clearCatCollection()
              }}
            >
              Clear cat collection
              <div className="ink-muted text-xs">Removes mentell.shop.cats from localStorage.</div>
            </button>

            <button
              type="button"
              disabled={busy}
              className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
              onClick={async () => {
                setBusy(true)
                try {
                  const database = getDb()
                  await database.entries.clear()
                  await database.notes.clear()
                  await database.stickies.clear()
                  await database.packages.clear()
                  await database.characterAppearance.clear()
                  clearShopInventory()
                  localStorage.removeItem(scopedStorageKey('mentell.score.total'))
                  localStorage.removeItem(scopedStorageKey('mentell.score.streak'))
                  localStorage.removeItem(scopedStorageKey('mentell.score.lastDay'))
                  localStorage.removeItem(scopedStorageKey('mentell.score.streakFreezes'))
                  localStorage.removeItem(scopedStorageKey('mentell.score.streakRestore'))
                  window.location.reload()
                } finally {
                  setBusy(false)
                }
              }}
            >
              Reset local data
              <div className="ink-muted text-xs">Clears IndexedDB + score keys.</div>
            </button>

            <button
              type="button"
              disabled={busy}
              className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
              onClick={async () => {
                localStorage.removeItem(scopedStorageKey('mentell.score.total'))
                localStorage.removeItem(scopedStorageKey('mentell.score.streak'))
                localStorage.removeItem(scopedStorageKey('mentell.score.lastDay'))
                localStorage.removeItem(scopedStorageKey('mentell.score.streakFreezes'))
                localStorage.removeItem(scopedStorageKey('mentell.score.streakRestore'))
                await refreshInspector()
              }}
            >
              Reset score only
              <div className="ink-muted text-xs">Keeps IndexedDB, clears score/streak.</div>
            </button>

            <button
              type="button"
              disabled={busy}
              className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
              onClick={async () => {
                setBusy(true)
                try {
                  const now = Date.now()
                  const mk = (dateKey: string, sentiment: '+' | '-' | '=') => ({
                    id: makeId('entry'),
                    createdAt: now,
                    updatedAt: now,
                    dateKey,
                    sentiment,
                    emotion: 'calm' as const,
                    emotionNote: '',
                    situation: `Seeded situation (${sentiment})`,
                    details: `Seeded details for ${dateKey}.\nA little stationery vibe.`,
                    behavioursNoted: sentiment === '-' ? 'Withdrew after conflict' : '',
                    reoccurringTheme: sentiment === '-' ? 'Avoidance after hard talks' : '',
                    flaggedTerms: [],
                    warningLevel: 'none' as const,
                    riskScore: 0,
                    interventionScore: 0,
                    riskLevel: 'none' as const,
                    scoreDelta: 100,
                    streakAtSubmit: 1,
                  })
                  await getDb().entries.bulkPut([
                    mk('2026-05-18', '+'),
                    mk('2026-05-19', '='),
                    mk('2026-05-20', '-'),
                  ])
                  await refreshInspector()
                } finally {
                  setBusy(false)
                }
              }}
            >
              Seed sample week
              <div className="ink-muted text-xs">Adds 3 entries for quick projector testing.</div>
            </button>
            <button
              type="button"
              disabled={busy}
              className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
              onClick={async () => {
                setBusy(true)
                try {
                  const now = Date.now()
                  const memories = [
                    {
                      dateKey: '2026-05-24',
                      emotion: 'calm' as const,
                      emotionNote: 'calm after a hard interaction',
                      situation: 'Maya helped me reset after a difficult interaction',
                      details:
                        'After a tense interaction at lunch, Maya walked with me to the blue bench by the library. We drank mint tea, watched the rain on the windows, and I remembered I could come back to myself.',
                    },
                    {
                      dateKey: '2026-05-27',
                      emotion: 'happy' as const,
                      emotionNote: 'proud after a presentation',
                      situation: 'I got through the presentation with the green note cards',
                      details:
                        'I was nervous about the history presentation, but I used my green note cards, took one slow breath, and Ms. Rivera said my opening story made the whole room listen.',
                    },
                    {
                      dateKey: '2026-05-30',
                      emotion: 'calm' as const,
                      emotionNote: 'steady during a deadline',
                      situation: 'The deadline felt possible after I broke it into tiny steps',
                      details:
                        'The project deadline stopped feeling overwhelming when I wrote three tiny tasks on a yellow sticky note, played the rain playlist, and finished the hardest paragraph before dinner.',
                    },
                    {
                      dateKey: '2026-06-02',
                      emotion: 'happy' as const,
                      emotionNote: 'seen by friends',
                      situation: 'Friends remembered the strawberry cupcake',
                      details:
                        'Jordan and Priya surprised me with a strawberry cupcake after rehearsal. They remembered the tiny candle joke, and I felt known in a way that stayed warm all evening.',
                    },
                  ]

                  await getDb().entries.bulkPut(
                    memories.map((memory, index) => ({
                      id: makeId('entry'),
                      createdAt: now + index,
                      updatedAt: now + index,
                      dateKey: memory.dateKey,
                      sentiment: '+' as const,
                      emotion: memory.emotion,
                      emotionNote: memory.emotionNote,
                      situation: memory.situation,
                      details: memory.details,
                      behavioursNoted: '',
                      reoccurringTheme: '',
                      flaggedTerms: [],
                      warningLevel: 'none' as const,
                      riskScore: 0,
                      interventionScore: -1.1,
                      riskLevel: 'none' as const,
                      scoreDelta: 100,
                      streakAtSubmit: 1,
                    })),
                  )
                  notifyLocalDataChanged()
                  await refreshInspector()
                } finally {
                  setBusy(false)
                }
              }}
            >
              Seed recall memories
              <div className="ink-muted text-xs">
                Adds detailed positive/calm entries for support-memory recall tests.
              </div>
            </button>
            <button
              type="button"
              disabled={busy}
              className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
              onClick={async () => {
                setBusy(true)
                try {
                  const now = Date.now()
                  await getDb().entries.put({
                    id: makeId('entry'),
                    createdAt: now,
                    updatedAt: now,
                    dateKey: '2026-05-21',
                    sentiment: '-' as const,
                    emotion: 'sad' as const,
                    emotionNote: '',
                    situation: 'Seeded subtle risk entry',
                    details: "I just don't think I can take it anymore. I am just going to do it.",
                    behavioursNoted: '',
                    reoccurringTheme: '',
                    flaggedTerms: ['take it anymore', 'going to do it'],
                    warningLevel: 'warn' as const,
                    riskScore: 0.22,
                    interventionScore: 1.1,
                    riskLevel: 'low' as const,
                    scoreDelta: 100,
                    streakAtSubmit: 1,
                  })
                  await refreshInspector()
                } finally {
                  setBusy(false)
                }
              }}
            >
              Seed subtle risk entry
              <div className="ink-muted text-xs">Adds a negative entry useful for AI risk modal testing.</div>
            </button>
            <button
              type="button"
              disabled={busy}
              className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
              onClick={async () => {
                setBusy(true)
                try {
                  const now = Date.now()
                  await getDb().entries.put({
                    id: makeId('entry'),
                    createdAt: now,
                    updatedAt: now,
                    dateKey: '2026-05-22',
                    sentiment: '+' as const,
                    emotion: 'happy' as const,
                    emotionNote: '',
                    situation: 'Seeded exce entry',
                    details:
                      'Today was amazing and joyful. I felt grateful, proud, hopeful, calm, loved, and excited about a wonderful win.',
                    behavioursNoted: '',
                    reoccurringTheme: '',
                    flaggedTerms: [],
                    warningLevel: 'none' as const,
                    riskScore: 0,
                    interventionScore: -1.3,
                    riskLevel: 'none' as const,
                    scoreDelta: 100,
                    streakAtSubmit: 1,
                  })
                  await refreshInspector()
                } finally {
                  setBusy(false)
                }
              }}
            >
              Seed exce entry
              <div className="ink-muted text-xs">Adds a highly positive entry for celebration modal testing.</div>
            </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="focus-ring paper shrink-0 rounded-3xl px-4 py-3 font-mono text-sm font-bold shadow-md"
            onClick={() => setOpen(true)}
          >
            debug
          </button>
        )}
      </div>
    </>
  )
}

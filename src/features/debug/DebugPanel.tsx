import { useEffect, useMemo, useState } from 'react'
import { db } from '../../db/schema'
import { makeId } from '../../shared/id'
import {
  getForcePackages,
  getSkipAiCache,
  getSlowMo,
  isDebugMode,
  setForcePackages,
  setSkipAiCache,
  setSlowMo,
} from '../../shared/debug/debugFlags'
import { clearWeeklyAiCache } from '../compilation/weeklyAiCache'
import { ensurePackage } from '../packages/packageService'
import { clearCatCollection } from '../shop/catCollection'
import { requestNotificationsPermission } from '../../pwa/notifications'
import { notifyScoreChanged } from '../score/scoreEvents'

export function DebugPanel() {
  const enabled = useMemo(() => isDebugMode(), [])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [slowMo, setSlowMoState] = useState(getSlowMo())
  const [forcePackages, setForcePackagesState] = useState(getForcePackages())
  const [skipAiCache, setSkipAiCacheState] = useState(getSkipAiCache())
  const [debugScore, setDebugScore] = useState('')
  const [debugStreak, setDebugStreak] = useState('')
  const [inspector, setInspector] = useState<{
    entries: number
    notes: number
    stickies: number
    packages: number
    scoreTotal: string | null
    scoreStreak: string | null
    lastDay: string | null
    recentEntries: Array<{ dateKey: string; sentiment: string; warningLevel: string }>
    recentPackages: Array<{ kind: string; periodKey: string; opened: boolean }>
  } | null>(null)

  async function refreshInspector() {
    const [entries, notes, stickies, packages] = await Promise.all([
      db.entries.count(),
      db.notes.count(),
      db.stickies.count(),
      db.packages.count(),
    ])

    const recentEntriesRows = await db.entries.orderBy('createdAt').reverse().limit(6).toArray()
    const recentPackagesRows = await db.packages.orderBy('createdAt').reverse().limit(6).toArray()

    setInspector({
      entries,
      notes,
      stickies,
      packages,
      scoreTotal: localStorage.getItem('mentell.score.total'),
      scoreStreak: localStorage.getItem('mentell.score.streak'),
      lastDay: localStorage.getItem('mentell.score.lastDay'),
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

  useEffect(() => {
    if (!enabled || !open) return
    const t = window.setTimeout(() => {
      refreshInspector()
    }, 0)
    return () => window.clearTimeout(t)
  }, [enabled, open])

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
                Local-only helpers · Esc or backdrop to dismiss
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

                <button
                  type="button"
                  disabled={busy}
                  className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                  onClick={async () => {
                    await requestNotificationsPermission()
                  }}
                >
                  Request notifications permission
                  <div className="ink-muted text-xs">For testing OS notification permission flow.</div>
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
                        await ensurePackage('weekly', `debug-W${Date.now()}`)
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
                      await ensurePackage('weekly', `debug-batch-W${Date.now()}`)
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
                      localStorage.setItem('mentell.score.total', String(total))
                      localStorage.setItem('mentell.score.streak', String(streak))
                      notifyScoreChanged()
                      setDebugScore('')
                      setDebugStreak('')
                      await refreshInspector()
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  Apply score &amp; streak
                  <div className="ink-muted text-xs">Updates localStorage and refreshes the top bar.</div>
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
                  await db.entries.clear()
                  await db.notes.clear()
                  await db.stickies.clear()
                  await db.packages.clear()
                  localStorage.removeItem('mentell.score.total')
                  localStorage.removeItem('mentell.score.streak')
                  localStorage.removeItem('mentell.score.lastDay')
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
                localStorage.removeItem('mentell.score.total')
                localStorage.removeItem('mentell.score.streak')
                localStorage.removeItem('mentell.score.lastDay')
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
                    dateKey,
                    sentiment,
                    emotion: 'calm' as const,
                    emotionNote: '',
                    situation: `Seeded situation (${sentiment})`,
                    details: `Seeded details for ${dateKey}.\nA little stationery vibe.`,
                    flaggedTerms: [],
                    warningLevel: 'none' as const,
                    scoreDelta: 100,
                    streakAtSubmit: 1,
                  })
                  await db.entries.bulkPut([
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


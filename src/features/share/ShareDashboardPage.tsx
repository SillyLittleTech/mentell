import { useEffect, useState } from 'react'
<<<<<<< Updated upstream
import { format } from 'date-fns'
import { Link, useParams } from 'react-router-dom'
import { isShareLinksEnabled } from '../../shared/features/featureFlags'
import { decryptProtectedShareEnvelope } from './shareCrypto'
import type { ShareDashboardPayload } from './shareTypes'
import {
  requestWeeklyAiSummary,
  weeklyAiSummaryEnabled,
  type WeeklyAiSummaryEntry,
} from '../compilation/weeklyAiSummary'
import { fetchPublicShare, type PublicShareDoc } from './shareCodeService'

export function ShareDashboardPage() {
  const { code = '' } = useParams()
  const enabled = isShareLinksEnabled()
  return <ShareDashboardPageInner key={code} code={code} enabled={enabled} />
}

function ShareDashboardPageInner({ code, enabled }: { code: string; enabled: boolean }) {
  const [doc, setDoc] = useState<PublicShareDoc | null | undefined>(undefined)
  const [payload, setPayload] = useState<ShareDashboardPayload | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [summary, setSummary] = useState<string | null>(null)
  const [summaryBusy, setSummaryBusy] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [unlockBusy, setUnlockBusy] = useState(false)
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const unlockStorageKey = code ? `mentell.share.unlock.${code}` : ''
  const [unlockCode, setUnlockCode] = useState(() =>
    unlockStorageKey ? sessionStorage.getItem(unlockStorageKey) ?? '' : '',
  )

  useEffect(() => {
    if (!enabled || !code) {
      return
    }

    let active = true
    void fetchPublicShare(code)
      .then((d) => {
        if (!active) return
        setDoc(d)
        if (d?.mode === 'snapshot') {
          setPayload(d.payload)
        }
      })
      .catch((error) => {
        if (!active) return
        setLoadError(error instanceof Error ? error.message : 'Could not load shared view.')
        setDoc(null)
      })

=======
import { useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { fetchPublicShare, type PublicShareDoc } from './shareCodeService'
import { isShareLinksEnabled } from '../../shared/features/featureFlags'

export function ShareDashboardPage() {
  const { code = '' } = useParams()
  const [doc, setDoc] = useState<PublicShareDoc | null | undefined>(undefined)
  const enabled = isShareLinksEnabled()

  useEffect(() => {
    if (!enabled || !code) {
      setDoc(null)
      return
    }
    let active = true
    void fetchPublicShare(code).then((d) => {
      if (active) setDoc(d)
    })
>>>>>>> Stashed changes
    return () => {
      active = false
    }
  }, [code, enabled])

<<<<<<< Updated upstream
  async function unlockProtectedShare(docEntry: PublicShareDoc) {
    if (docEntry.mode !== 'protected') return
    const trimmed = unlockCode.trim()
    if (!trimmed) {
      setUnlockError('Enter the viewer code to open this protected link.')
      return
    }

    setUnlockBusy(true)
    setUnlockError(null)
    try {
      const nextPayload = await decryptProtectedShareEnvelope(docEntry.payloadEnvelope, trimmed)
      setPayload(nextPayload)
      if (unlockStorageKey) {
        sessionStorage.setItem(unlockStorageKey, trimmed)
      }
    } catch {
      setPayload(null)
      setUnlockError('That code did not unlock this shared view.')
    } finally {
      setUnlockBusy(false)
    }
  }

  async function generateOverview(docEntry: PublicShareDoc, currentPayload: ShareDashboardPayload) {
    if (!currentPayload.entries.length) return
    setSummaryBusy(true)
    setSummaryError(null)
    try {
      const entries: WeeklyAiSummaryEntry[] = currentPayload.entries.map((entry) => ({
        id: entry.id,
        createdAt: entry.createdAt,
        dateKey: entry.dateKey,
        sentiment: entry.sentiment,
        emotion: entry.emotion,
        emotionNote: entry.emotionNote,
        situation: entry.situation ?? '',
        details: entry.details ?? '',
      }))
      const result = await requestWeeklyAiSummary(entries, {
        mode: 'overview',
        profile: {
          displayName: '',
          ageRange: 'prefer-not',
          about: '',
        },
        weekKey: code || docEntry.label,
      })
      setSummary(result.summary)
    } catch (error) {
      setSummaryError(error instanceof Error ? error.message : 'Failed to generate overview.')
    } finally {
      setSummaryBusy(false)
    }
  }

  function toggleExpanded(entryId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(entryId)) next.delete(entryId)
      else next.add(entryId)
      return next
    })
  }

=======
>>>>>>> Stashed changes
  if (!enabled) {
    return (
      <div className="desk flex min-h-[100svh] items-center justify-center p-6">
        <div className="paper max-w-md rounded-3xl p-6 text-center">
          <div className="font-paper text-xl">Sharing is disabled</div>
          <div className="ink-muted mt-2 text-sm">This build does not include share links.</div>
        </div>
      </div>
    )
  }

  if (doc === undefined) {
    return (
      <div className="desk flex min-h-[100svh] items-center justify-center p-6">
<<<<<<< Updated upstream
        <div className="ink-muted font-mono text-sm">Loading shared view...</div>
=======
        <div className="ink-muted font-mono text-sm">Loading shared view…</div>
>>>>>>> Stashed changes
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="desk flex min-h-[100svh] items-center justify-center p-6">
        <div className="paper max-w-md rounded-3xl p-6 text-center">
<<<<<<< Updated upstream
          <div className="font-paper text-xl">Shared view unavailable</div>
          <div className="ink-muted mt-2 text-sm">
            {loadError ?? 'This share link has been revoked or expired.'}
          </div>
          <Link
            to="/"
            className="focus-ring mt-4 inline-flex rounded-2xl border border-[var(--paper-border)] px-4 py-2 text-sm font-semibold"
          >
            Return to Mentell
          </Link>
=======
          <div className="font-paper text-xl">Link unavailable</div>
          <div className="ink-muted mt-2 text-sm">
            This share link is invalid or has expired.
          </div>
>>>>>>> Stashed changes
        </div>
      </div>
    )
  }

<<<<<<< Updated upstream
  const resolvedPayload = doc.mode === 'snapshot' ? doc.payload : payload
  const canGenerateOverview =
    weeklyAiSummaryEnabled() &&
    doc.permissions.showRecentEntries &&
    resolvedPayload !== null &&
    resolvedPayload.entries.length > 0
=======
  const p = doc.payload
>>>>>>> Stashed changes
  const expires = format(doc.expiresAt.toDate(), 'PPp')

  return (
    <div className="desk min-h-[100svh] px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-4">
        <header className="paper rounded-3xl p-6 text-center">
          <div className="font-paper text-2xl">Mentell shared view</div>
          {doc.ownerDisplayName ? (
            <div className="ink-muted mt-1 text-sm">Shared by {doc.ownerDisplayName}</div>
          ) : null}
          {doc.label ? <div className="mt-2 font-medium">{doc.label}</div> : null}
<<<<<<< Updated upstream
          <div className="ink-muted mt-2 text-xs">
            Read-only | {doc.mode === 'protected' ? 'renew by' : 'expires'} {expires}
          </div>
        </header>

        {resolvedPayload ? (
          <section className="paper rounded-3xl p-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {doc.permissions.showEntryCounts ? (
                <Stat label="Entries" value={String(resolvedPayload.entryCount)} />
              ) : null}
              {doc.permissions.showSentimentBreakdown ? (
                <>
                  <Stat label="+" value={String(resolvedPayload.positives)} />
                  <Stat label="=" value={String(resolvedPayload.mixed)} />
                  <Stat label="-" value={String(resolvedPayload.negatives)} />
                </>
              ) : null}
              {doc.permissions.showWarningsCount ? (
                <Stat label="Warnings" value={String(resolvedPayload.warnings)} />
              ) : null}
              {doc.permissions.showStreak && resolvedPayload.streak !== undefined ? (
                <Stat label="Streak" value={String(resolvedPayload.streak)} />
              ) : null}
              {doc.permissions.showScore && resolvedPayload.score !== undefined ? (
                <Stat label="Score" value={String(resolvedPayload.score)} />
              ) : null}
            </div>
          </section>
        ) : null}

        {doc.mode === 'protected' && !resolvedPayload ? (
          <section className="paper rounded-3xl p-6">
            <div className="font-paper text-lg">Protected link</div>
            <div className="ink-muted mt-1 text-sm">
              Enter the viewer code to unlock the latest shared data.
            </div>
            <div className="mt-4 grid gap-2">
              <input
                className="focus-ring rounded-2xl border border-[var(--paper-border)] bg-transparent px-3 py-2"
                value={unlockCode}
                onChange={(e) => setUnlockCode(e.target.value)}
                placeholder="Viewer code"
                autoComplete="off"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void unlockProtectedShare(doc)
                }}
              />
              <button
                type="button"
                className="focus-ring rounded-2xl border border-[var(--paper-border)] px-4 py-2 text-sm font-semibold"
                disabled={unlockBusy}
                onClick={() => void unlockProtectedShare(doc)}
              >
                {unlockBusy ? 'Unlocking...' : 'Unlock shared view'}
              </button>
            </div>
            {unlockError ? (
              <div className="mt-3 rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-sm text-[var(--danger)]">
                {unlockError}
              </div>
            ) : null}
          </section>
        ) : null}

        {doc.mode === 'protected' && resolvedPayload ? (
          <section className="paper rounded-3xl p-6">
            <div className="font-paper text-lg">Protected view unlocked</div>
            <div className="ink-muted mt-1 text-sm">
              This view will keep using the same slug until it is revoked or renewed.
            </div>
          </section>
        ) : null}

        {canGenerateOverview && resolvedPayload ? (
          <section className="paper rounded-3xl p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-paper text-lg">Narrative overview</div>
                <div className="ink-muted mt-1 text-sm">
                  Generate an objective summary of the shared entries.
                </div>
              </div>
              <button
                type="button"
                className="focus-ring rounded-2xl border border-[var(--paper-border)] px-4 py-2 text-sm font-semibold"
                disabled={summaryBusy}
                onClick={() => void generateOverview(doc, resolvedPayload)}
              >
                {summaryBusy ? 'Generating...' : summary ? 'Regenerate overview' : 'Generate overview'}
              </button>
            </div>

            {summaryError ? (
              <div className="mt-3 rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-sm text-[var(--danger)]">
                {summaryError}
              </div>
            ) : null}

            {summary ? (
              <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-[var(--paper-border)] p-4 font-paper text-lg leading-relaxed">
                {summary}
              </div>
            ) : null}
          </section>
        ) : null}

        {doc.permissions.showRecentEntries && resolvedPayload?.entries.length ? (
          <section className="paper rounded-3xl p-6">
            <div className="font-paper text-lg">Recent entries</div>
            <ul className="mt-4 space-y-3">
              {resolvedPayload.entries.map((e) => {
                const expanded = expandedIds.has(e.id)
                const warningFlagged = e.warningLevel === 'warn'
                return (
                  <li
                    key={e.id}
                    className="overflow-hidden rounded-2xl border"
                    style={styleForSentiment(e.sentiment)}
                  >
                    <button
                      type="button"
                      className="focus-ring flex w-full items-start justify-between gap-3 px-4 py-4 text-left"
                      onClick={() => toggleExpanded(e.id)}
                      aria-expanded={expanded}
                      aria-controls={`share-entry-${e.id}`}
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-sm">{e.dateKey}</div>
                        {e.situation ? (
                          <div className="mt-2 font-medium">{e.situation}</div>
                        ) : (
                          <div className="ink-muted mt-2 text-sm">No situation provided</div>
                        )}
                        {e.emotion || e.emotionNote ? (
                          <div className="ink-muted mt-1 text-sm">
                            Emotion: {e.emotionNote ? e.emotionNote : labelForEmotion(e.emotion ?? '')}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span className="rounded-full border border-[var(--paper-border)] px-2 py-1 font-mono text-lg font-bold leading-none">
                          {e.sentiment}
                        </span>
                        <span className="rounded-full border border-[var(--paper-border)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]">
                          {expanded ? 'Hide' : 'Expand'}
                        </span>
                        {warningFlagged ? (
                          <span className="rounded-full border border-[var(--paper-border)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--danger)]">
                            Warning
                          </span>
                        ) : null}
                      </div>
                    </button>

                    {expanded ? (
                      <div
                        id={`share-entry-${e.id}`}
                        className="border-t border-[var(--paper-border)] px-4 py-4"
                      >
                        {e.details ? (
                          <div className="whitespace-pre-wrap text-sm leading-relaxed">
                            {e.details}
                          </div>
                        ) : (
                          <div className="ink-muted text-sm">No extra details provided.</div>
                        )}
                      </div>
                    ) : null}
                  </li>
                )
              })}
=======
          <div className="ink-muted mt-2 text-xs">Read-only · expires {expires}</div>
        </header>

        <section className="paper rounded-3xl p-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {doc.permissions.showEntryCounts ? (
              <Stat label="Entries" value={String(p.entryCount)} />
            ) : null}
            {doc.permissions.showSentimentBreakdown ? (
              <>
                <Stat label="+" value={String(p.positives)} />
                <Stat label="=" value={String(p.mixed)} />
                <Stat label="-" value={String(p.negatives)} />
              </>
            ) : null}
            {doc.permissions.showWarningsCount ? (
              <Stat label="Warnings" value={String(p.warnings)} />
            ) : null}
            {doc.permissions.showStreak && p.streak !== undefined ? (
              <Stat label="Streak" value={String(p.streak)} />
            ) : null}
            {doc.permissions.showScore && p.score !== undefined ? (
              <Stat label="Score" value={String(p.score)} />
            ) : null}
          </div>
        </section>

        {doc.permissions.showRecentEntries && p.entries.length > 0 ? (
          <section className="paper rounded-3xl p-6">
            <div className="font-paper text-lg">Recent entries</div>
            <ul className="mt-4 space-y-3">
              {p.entries.map((e) => (
                <li
                  key={e.id}
                  className="rounded-2xl border border-[var(--paper-border)] p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm">{e.dateKey}</span>
                    <span className="font-mono text-lg font-bold">{e.sentiment}</span>
                  </div>
                  {e.situation ? (
                    <div className="mt-2 font-medium">{e.situation}</div>
                  ) : null}
                  {e.emotion ? (
                    <div className="ink-muted mt-1 text-sm">Emotion: {e.emotion}</div>
                  ) : null}
                  {e.details ? (
                    <div className="ink-muted mt-2 whitespace-pre-wrap text-sm">{e.details}</div>
                  ) : null}
                </li>
              ))}
>>>>>>> Stashed changes
            </ul>
          </section>
        ) : null}

        <footer className="ink-muted text-center text-xs">
          Not for emergency use. Not a clinical record. Mentell does not certify HIPAA
          compliance on the free tier.
        </footer>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-center">
      <div className="font-mono text-[10px] uppercase opacity-70">{label}</div>
      <div className="font-mono text-xl font-bold">{value}</div>
    </div>
  )
}
<<<<<<< Updated upstream

function styleForSentiment(sentiment: '+' | '-' | '=') {
  if (sentiment === '+') {
    return {
      borderColor: 'rgba(42,155,88,0.35)',
      background: 'rgba(42,155,88,0.1)',
    }
  }
  if (sentiment === '-') {
    return {
      borderColor: 'rgba(198,29,29,0.35)',
      background: 'rgba(198,29,29,0.1)',
    }
  }
  return {
    borderColor: 'rgba(224,178,44,0.35)',
    background: 'rgba(224,178,44,0.12)',
  }
}

function labelForEmotion(emotion: string) {
  if (emotion === 'happy') return 'Happy'
  if (emotion === 'calm') return 'Calm'
  if (emotion === 'anxious') return 'Anxious'
  if (emotion === 'sad') return 'Sad'
  if (emotion === 'angry') return 'Angry'
  return 'Other'
}
=======
>>>>>>> Stashed changes

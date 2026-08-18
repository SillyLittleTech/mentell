import { useEffect, useState } from 'react'
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

    return () => {
      active = false
    }
  }, [code, enabled])

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

  if (!enabled) {
    return (
      <div className="desk flex min-h-[100svh] items-center justify-center p-6">
        <div className="paper max-w-md rounded-3xl p-6 text-center">
          <div className="font-paper text-xl">Sharing is disabled</div>
          <div className="ink-muted mt-2 text-sm">Share links are currently unavailable (EC104).</div>
        </div>
      </div>
    )
  }

  if (doc === undefined) {
    return (
      <div className="desk flex min-h-[100svh] items-center justify-center p-6">
        <div className="ink-muted font-mono text-sm">Loading shared view...</div>
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="desk flex min-h-[100svh] items-center justify-center p-6">
        <div className="paper max-w-md rounded-3xl p-6 text-center">
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
        </div>
      </div>
    )
  }

  const resolvedPayload = doc.mode === 'snapshot' ? doc.payload : payload
  const canGenerateOverview =
    weeklyAiSummaryEnabled() &&
    doc.permissions.showRecentEntries &&
    resolvedPayload !== null &&
    resolvedPayload.entries.length > 0
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
                        {e.behavioursNoted?.trim() ? (
                          <div className="mt-3">
                            <div className="ink-muted text-xs font-medium uppercase tracking-wide">
                              Behaviours noted
                            </div>
                            <div className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                              {e.behavioursNoted}
                            </div>
                          </div>
                        ) : null}
                        {e.reoccurringTheme?.trim() ? (
                          <div className="mt-3">
                            <div className="ink-muted text-xs font-medium uppercase tracking-wide">
                              Reoccurring theme
                            </div>
                            <div className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                              {e.reoccurringTheme}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                )
              })}
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

const EMOTION_LABELS: Record<string, string> = {
  happy: 'Happy',
  calm: 'Calm',
  anxious: 'Anxious',
  sad: 'Sad',
  angry: 'Angry',
}

function labelForEmotion(emotion: string) {
  return EMOTION_LABELS[emotion] || 'Other'
}

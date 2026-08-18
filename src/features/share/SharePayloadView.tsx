import { useState } from 'react'
import type { ShareDashboardPayload, SharePermissions } from './shareTypes'

export function SharePayloadView({
  payload,
  permissions,
}: {
  payload: ShareDashboardPayload
  permissions?: SharePermissions | null
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const showEntryCounts = permissions ? permissions.showEntryCounts : true
  const showSentimentBreakdown = permissions ? permissions.showSentimentBreakdown : true
  const showWarningsCount = permissions ? permissions.showWarningsCount : true
  const showStreak = permissions ? permissions.showStreak : payload.streak !== undefined
  const showScore = permissions ? permissions.showScore : payload.score !== undefined
  const showRecentEntries = permissions ? permissions.showRecentEntries : true

  function toggleExpanded(entryId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(entryId)) next.delete(entryId)
      else next.add(entryId)
      return next
    })
  }

  return (
    <>
      <section className="paper rounded-3xl p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {showEntryCounts ? <Stat label="Entries" value={String(payload.entryCount)} /> : null}
          {showSentimentBreakdown ? (
            <>
              <Stat label="+" value={String(payload.positives)} />
              <Stat label="=" value={String(payload.mixed)} />
              <Stat label="-" value={String(payload.negatives)} />
            </>
          ) : null}
          {showWarningsCount ? <Stat label="Warnings" value={String(payload.warnings)} /> : null}
          {showStreak && payload.streak !== undefined ? (
            <Stat label="Streak" value={String(payload.streak)} />
          ) : null}
          {showScore && payload.score !== undefined ? (
            <Stat label="Score" value={String(payload.score)} />
          ) : null}
        </div>
      </section>

      {showRecentEntries && payload.entries.length ? (
        <section className="paper rounded-3xl p-6">
          <div className="font-paper text-lg">Recent entries</div>
          <ul className="mt-4 space-y-3">
            {payload.entries.map((e) => {
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
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">{e.details}</div>
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
    </>
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

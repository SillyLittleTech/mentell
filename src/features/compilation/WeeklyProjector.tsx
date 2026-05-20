import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { dateKeyForLocalDay } from '../../shared/dates'
import { getWeeklyStatsForDateKey, type WeeklyStats } from './weeklyStats'
import { getScoreSnapshot } from '../score/scoreService'
import { hasDeliveredWeeklyPackage } from '../packages/packageService'
import { requestWeeklyAiSummary, weeklyAiSummaryEnabled } from './weeklyAiSummary'

export function WeeklyProjector() {
  const todayKey = useMemo(() => dateKeyForLocalDay(new Date()), [])
  const [stats, setStats] = useState<WeeklyStats | null>(null)
  const [delivered, setDelivered] = useState<boolean | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [score, setScore] = useState(() => getScoreSnapshot())
  const [summary, setSummary] = useState<string | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [summaryBusy, setSummaryBusy] = useState(false)
  const aiEnabled = weeklyAiSummaryEnabled()

  useEffect(() => {
    let active = true

    const refresh = async () => {
      const [nextStats, hasDelivery] = await Promise.all([
        getWeeklyStatsForDateKey(todayKey),
        hasDeliveredWeeklyPackage(),
      ])
      if (!active) return
      setStats(nextStats)
      setDelivered(hasDelivery)
      setScore(getScoreSnapshot())
    }

    refresh()
    const id = window.setInterval(refresh, 2000)
    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [todayKey])

  const selected = useMemo(() => {
    if (!stats || !selectedId) return null
    return stats.entries.find((e) => e.id === selectedId) ?? null
  }, [selectedId, stats])

  if (!stats || delivered === null) {
    return (
      <div className="paper rounded-3xl p-6">
        <div className="font-paper text-2xl">Projector warming up…</div>
        <div className="ink-muted mt-2 text-sm">Loading your week and package status.</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="paper rounded-3xl p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <div className="font-paper text-2xl">Weekly compilation</div>
            <div className="ink-muted mt-1 text-sm">
              {stats.weekKey} ({stats.startDateKey} → {stats.endDateKey})
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StatChip label="+">{stats.positives}</StatChip>
            <StatChip label="=">{stats.mixed}</StatChip>
            <StatChip label="-">{stats.negatives}</StatChip>
            <StatChip label="!">{stats.warnings}</StatChip>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <ProjectorCard title="Entries logged" value={stats.total} />
          <ProjectorCard title="Warnings flagged" value={stats.warnings} />
          <ProjectorCard title="Current score" value={score.total} />
          <ProjectorCard title="Current streak" value={score.streak} />
        </div>
      </div>

      {!delivered ? (
        <div className="paper rounded-3xl p-6">
          <div className="font-paper text-xl">Report locked</div>
          <div className="ink-muted mt-1 text-sm">
            The weekly report appears only after the truck delivers a weekly package.
          </div>
        </div>
      ) : null}

      {aiEnabled && delivered ? (
        <div className="paper rounded-3xl p-6">
          <div className="font-paper text-xl">AI summary</div>
          <div className="ink-muted mt-1 text-sm">
            Generate a concise reflection of this week using your configured Worker endpoint.
          </div>

          <button
            type="button"
            className="focus-ring mt-4 rounded-2xl px-4 py-3 text-sm font-semibold"
            style={{ background: 'var(--warn)', color: 'rgba(0,0,0,0.85)' }}
            disabled={summaryBusy || stats.entries.length === 0}
            onClick={async () => {
              setSummaryBusy(true)
              setSummaryError(null)
              try {
                const res = await requestWeeklyAiSummary(stats.entries)
                setSummary(res.summary)
              } catch (error) {
                setSummaryError(error instanceof Error ? error.message : 'Failed to generate summary.')
              } finally {
                setSummaryBusy(false)
              }
            }}
          >
            {summaryBusy ? 'Generating…' : 'Generate weekly AI summary'}
          </button>

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
        </div>
      ) : null}

      <div className="paper rounded-3xl p-6">
        <div className="font-paper text-xl">Slides</div>
        <div className="ink-muted mt-1 text-sm">
          Click a slide to preview more details (situation + full text).
        </div>

        <div className="mt-4 grid gap-3">
          {!delivered ? (
            <div className="ink-muted rounded-2xl border border-[var(--paper-border)] p-4">
              No delivered weekly report yet.
            </div>
          ) : stats.entries.length === 0 ? (
            <div className="ink-muted rounded-2xl border border-[var(--paper-border)] p-4">
              No entries yet this week — submit a letter to start your reel.
            </div>
          ) : (
            stats.entries.map((e) => (
              <button
                key={e.id}
                type="button"
                className="focus-ring rounded-2xl border px-4 py-3 text-left hover:opacity-95"
                style={styleForSentiment(e.sentiment)}
                onClick={() => setSelectedId(e.id)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">
                    {e.dateKey} <span className="font-mono">[{e.sentiment}]</span>
                  </div>
                  {e.warningLevel === 'warn' ? (
                    <div className="rounded-xl border border-[var(--paper-border)] px-2 py-1 text-sm">
                      <span style={{ color: 'var(--danger)' }}>!</span>
                    </div>
                  ) : null}
                </div>
                <div className="ink-muted mt-1 line-clamp-1 text-sm">{e.situation || '—'}</div>
                <div className="ink-muted mt-1 text-xs">
                  Emotion: {e.emotionNote ? e.emotionNote : labelForEmotion(e.emotion)}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <AnimatePresence>
        {selected && delivered ? (
          <motion.div
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedId(null)}
          >
            <motion.div
              className="paper w-full max-w-2xl rounded-3xl p-6"
              initial={{ scale: 0.96, y: 18 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.98, y: 10 }}
              transition={{ duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-paper text-2xl">
                    Slide preview <span className="font-mono">[{selected.sentiment}]</span>
                  </div>
                  <div className="ink-muted mt-1 text-sm">{selected.dateKey}</div>
                </div>
                <button
                  type="button"
                  className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-sm"
                  onClick={() => setSelectedId(null)}
                >
                  Close
                </button>
              </div>

              {selected.warningLevel === 'warn' ? (
                <div className="mt-4 rounded-2xl border border-[var(--paper-border)] p-4">
                  <div className="font-medium" style={{ color: 'var(--danger)' }}>
                    Flagged terms: {selected.flaggedTerms.join(', ') || '—'}
                  </div>
                  <div className="ink-muted mt-1 text-sm">
                    If you’re in immediate danger or need urgent help, consider contacting local emergency
                    services.
                  </div>
                </div>
              ) : null}

              <div className="mt-5 grid gap-4">
                <div>
                  <div className="ink-muted text-sm font-medium">Situation</div>
                  <div className="mt-2 rounded-2xl border border-[var(--paper-border)] p-4 font-paper text-lg">
                    {selected.situation || '—'}
                  </div>
                </div>
                <div>
                  <div className="ink-muted text-sm font-medium">Emotion</div>
                  <div className="mt-2 rounded-2xl border border-[var(--paper-border)] p-4">
                    {selected.emotionNote ? selected.emotionNote : labelForEmotion(selected.emotion)}
                  </div>
                </div>
                <div>
                  <div className="ink-muted text-sm font-medium">Details</div>
                  <div className="mt-2 whitespace-pre-wrap rounded-2xl border border-[var(--paper-border)] p-4 font-paper text-lg leading-relaxed">
                    {selected.details || '—'}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
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

function labelForEmotion(emotion: string) {
  if (emotion === 'happy') return 'Happy'
  if (emotion === 'calm') return 'Calm'
  if (emotion === 'anxious') return 'Anxious'
  if (emotion === 'sad') return 'Sad'
  if (emotion === 'angry') return 'Angry'
  return 'Other'
}

function StatChip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-[var(--paper-border)] px-3 py-2">
      <div className="font-mono text-xl">{label}</div>
      <div className="text-sm font-medium">{children}</div>
    </div>
  )
}

function ProjectorCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-3xl border border-[var(--paper-border)] p-5">
      <div className="ink-muted text-sm">{title}</div>
      <div className="mt-2 font-mono text-4xl font-black">{value}</div>
    </div>
  )
}


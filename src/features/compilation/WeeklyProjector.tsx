import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { dateKeyForLocalDay } from '../../shared/dates'
import { getWeeklyStatsForDateKey, type WeeklyStats } from './weeklyStats'

export function WeeklyProjector() {
  const todayKey = useMemo(() => dateKeyForLocalDay(new Date()), [])
  const [stats, setStats] = useState<WeeklyStats | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    getWeeklyStatsForDateKey(todayKey).then(setStats)
  }, [todayKey])

  const selected = useMemo(() => {
    if (!stats || !selectedId) return null
    return stats.entries.find((e) => e.id === selectedId) ?? null
  }, [selectedId, stats])

  if (!stats) {
    return (
      <div className="paper rounded-3xl p-6">
        <div className="font-paper text-2xl">Projector warming up…</div>
        <div className="ink-muted mt-2 text-sm">Loading your week.</div>
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

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <ProjectorCard title="Entries logged" value={stats.total} />
          <ProjectorCard title="Warnings flagged" value={stats.warnings} />
        </div>
      </div>

      <div className="paper rounded-3xl p-6">
        <div className="font-paper text-xl">Slides</div>
        <div className="ink-muted mt-1 text-sm">
          Click a slide to preview more details (situation + full text).
        </div>

        <div className="mt-4 grid gap-3">
          {stats.entries.length === 0 ? (
            <div className="ink-muted rounded-2xl border border-[var(--paper-border)] p-4">
              No entries yet this week — submit a letter to start your reel.
            </div>
          ) : (
            stats.entries.map((e) => (
              <button
                key={e.id}
                type="button"
                className="focus-ring rounded-2xl border border-[var(--paper-border)] px-4 py-3 text-left hover:opacity-95"
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
              </button>
            ))
          )}
        </div>
      </div>

      <AnimatePresence>
        {selected ? (
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


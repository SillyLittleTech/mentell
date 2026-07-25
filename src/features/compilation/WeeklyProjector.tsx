import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { MaterialIcon } from '../../components/MaterialIcon'
import { dateKeyForLocalDay } from '../../shared/dates'
import {
  getEntriesForWeeksBefore,
  getWeeklyStatsForDateKey,
  getWeeklyStatsForWeekKey,
  type WeekCursor,
  type WeeklyStats,
} from './weeklyStats'
import type { EntryRow } from '../../db/schema'
import { getScoreSnapshot } from '../score/scoreService'
import { StreakDisplay } from '../score/StreakDisplay'
import { SCORE_CHANGED_EVENT } from '../score/scoreEvents'
import { useBodyScrollLock } from '../../shared/motion/useBodyScrollLock'
import { motionDuration, shouldReduceMotion } from '../../shared/motion/useMotionPrefs'
import { getLatestDeliveredWeeklyPackage } from '../packages/packageService'
import { useOnlineStatus } from '../../shared/offline/useOnlineStatus'
import {
  buildAiSummaryMarkdown,
  downloadTextFile,
  requestWeeklyAiSummary,
  weeklyAiSummaryEnabled,
  type AiSummaryMode,
} from './weeklyAiSummary'
import { loadAiProfile, profileFingerprint, type AiProfile } from './aiProfile'
import { clearWeeklyAiCache, getCachedWeeklySummary } from './weeklyAiCache'
import { SharingPanel } from '../settings/SharingSection'
import { WeeklyAiSettings, WeeklyAiSettingsButton } from './WeeklyAiSettings'
import {
  buildRawReportHtml,
  downloadRawReportHtml,
  fetchEntriesForRange,
  type RawReportRange,
} from './weeklyReportExport'
import {
  ProjectorEntryDetail,
  ProjectorEntrySlide,
} from './ProjectorEntrySlide'
import { ProjectorSearchModal } from './ProjectorSearchModal'
import { projectorSearchEnabled, type ProjectorSearchResult } from './projectorSearch'
import {
  PROJECTOR_DEBUG_EVENT,
  type ProjectorDebugDetail,
} from '../debug/projectorDebug'

function profileActiveHint(profile: AiProfile) {
  if (profile.about.trim()) {
    const snippet = profile.about.trim().slice(0, 60)
    return snippet.length < profile.about.trim().length ? `${snippet}…` : snippet
  }
  if (profile.displayName.trim()) return `Name: ${profile.displayName}`
  return null
}

export type OlderWeekBatch = {
  weekKey: string
  startDateKey: string
  endDateKey: string
  entries: EntryRow[]
}

export function WeeklyProjector() {
  const todayKey = useMemo(() => dateKeyForLocalDay(new Date()), [])
  const [stats, setStats] = useState<WeeklyStats | null>(null)
  const [delivered, setDelivered] = useState<boolean | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [score, setScore] = useState(() => getScoreSnapshot())
  const [summary, setSummary] = useState<string | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [summaryBusy, setSummaryBusy] = useState(false)
  const [fromCache, setFromCache] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [debugSearchSeed, setDebugSearchSeed] = useState<ProjectorSearchResult | null>(null)
  const [profile, setProfile] = useState<AiProfile>(() => loadAiProfile())
  const [mode, setMode] = useState<AiSummaryMode>('reflection')
  const [rawRange, setRawRange] = useState<RawReportRange>('week')
  const [rawBusy, setRawBusy] = useState(false)
  const [settingsStale, setSettingsStale] = useState(false)
  const [olderWeeks, setOlderWeeks] = useState<OlderWeekBatch[]>([])
  const [olderAnchorWeek, setOlderAnchorWeek] = useState<string | null>(null)
  const [paginationCursor, setPaginationCursor] = useState<WeekCursor>(null)
  const [hasMoreWeeks, setHasMoreWeeks] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const aiEnabled = weeklyAiSummaryEnabled()
  const searchEnabled = projectorSearchEnabled()
  const isOnline = useOnlineStatus()

  const visibleOlderWeeks = useMemo(
    () => (stats && olderAnchorWeek === stats.weekKey ? olderWeeks : []),
    [stats, olderAnchorWeek, olderWeeks],
  )

  useEffect(() => {
    const onDebug = (event: Event) => {
      const detail = (event as CustomEvent<ProjectorDebugDetail>).detail
      if (!detail) return
      if (detail.action === 'open-search') {
        setDebugSearchSeed(detail.seed ?? null)
        setSearchOpen(true)
      } else if (detail.action === 'close-search') {
        setSearchOpen(false)
        setDebugSearchSeed(null)
      }
    }
    window.addEventListener(PROJECTOR_DEBUG_EVENT, onDebug)
    return () => window.removeEventListener(PROJECTOR_DEBUG_EVENT, onDebug)
  }, [])

  const restoreCachedSummary = useCallback(
    (nextStats: WeeklyStats, nextProfile: AiProfile, nextMode: AiSummaryMode) => {
      const cached = getCachedWeeklySummary({
        weekKey: nextStats.weekKey,
        mode: nextMode,
        entries: nextStats.entries,
        profile: nextProfile,
      })
      if (cached) {
        setSummary(cached)
        setFromCache(true)
        setSettingsStale(false)
      }
    },
    [],
  )

  useEffect(() => {
    let active = true

    const refresh = async () => {
      try {
        const latestPackage = await getLatestDeliveredWeeklyPackage()
        const nextStats = latestPackage
          ? await getWeeklyStatsForWeekKey(latestPackage.periodKey)
          : await getWeeklyStatsForDateKey(todayKey)
        if (!active) return
        setStats(nextStats)
        setDelivered(Boolean(latestPackage))
        setScore(getScoreSnapshot())
        if (aiEnabled && latestPackage && nextStats.entries.length > 0) {
          restoreCachedSummary(nextStats, profile, mode)
        }
      } catch (error) {
        console.warn('[mentell] Weekly projector refresh failed', error)
        const fallbackStats = await getWeeklyStatsForDateKey(todayKey)
        if (!active) return
        setStats(fallbackStats)
        setDelivered(false)
        setScore(getScoreSnapshot())
      }
    }

    refresh()
    const id = window.setInterval(refresh, 2000)
    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [todayKey, aiEnabled, profile, mode, restoreCachedSummary])

  useEffect(() => {
    const onScore = () => setScore(getScoreSnapshot())
    window.addEventListener(SCORE_CHANGED_EVENT, onScore)
    return () => window.removeEventListener(SCORE_CHANGED_EVENT, onScore)
  }, [])

  // Reset older weeks when primary week changes
  // (handled via olderAnchorWeek mismatch — no effect needed)

  const allEntriesForPreview = useMemo(() => {
    const map = new Map<string, EntryRow>()
    for (const e of stats?.entries ?? []) map.set(e.id, e)
    for (const batch of visibleOlderWeeks) {
      for (const e of batch.entries) map.set(e.id, e)
    }
    return map
  }, [stats, visibleOlderWeeks])

  const selected = selectedId ? allEntriesForPreview.get(selectedId) ?? null : null
  useBodyScrollLock(Boolean(selected && delivered))

  async function handleGenerate() {
    if (!stats) return
    setSummaryBusy(true)
    setSummaryError(null)
    setFromCache(false)
    try {
      const res = await requestWeeklyAiSummary(stats.entries, {
        mode,
        profile,
        weekKey: stats.weekKey,
      })
      setSummary(res.summary)
      setFromCache(res.fromCache)
      setSettingsStale(false)
    } catch (error) {
      setSummaryError(error instanceof Error ? error.message : 'Failed to generate summary.')
    } finally {
      setSummaryBusy(false)
    }
  }

  async function handleRawDownload() {
    setRawBusy(true)
    try {
      const anchorDateKey = delivered && stats?.startDateKey ? stats.startDateKey : todayKey
      const entries = await fetchEntriesForRange(rawRange, anchorDateKey)
      const html = buildRawReportHtml({ range: rawRange, anchorDateKey, entries })
      const suffix =
        rawRange === 'week' ? stats?.weekKey ?? 'week' : rawRange === 'last4' ? 'last4w' : 'all'
      downloadRawReportHtml(html, `mentell-raw-${suffix}.html`)
    } finally {
      setRawBusy(false)
    }
  }

  async function handleShowMore() {
    if (!stats || loadingMore || !hasMoreWeeks) return
    const cursorForWeek = olderAnchorWeek === stats.weekKey ? paginationCursor : null
    setLoadingMore(true)
    try {
      const { batches, nextCursor } = await getEntriesForWeeksBefore(
        stats.weekKey,
        cursorForWeek,
        1,
      )
      if (batches.length > 0) {
        setOlderWeeks((prev) =>
          olderAnchorWeek === stats.weekKey ? [...prev, ...batches] : [...batches],
        )
        setOlderAnchorWeek(stats.weekKey)
      }
      setPaginationCursor(nextCursor)
      setHasMoreWeeks(Boolean(nextCursor))
    } finally {
      setLoadingMore(false)
    }
  }

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
              {stats.weekKey} ({stats.startDateKey || '—'} → {stats.endDateKey || '—'})
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <StatChip label="+">{stats.positives}</StatChip>
            <StatChip label="=">{stats.mixed}</StatChip>
            <StatChip label="-">{stats.negatives}</StatChip>
            <StatChip label="!">{stats.warnings}</StatChip>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
          <ProjectorCard title="Entries logged" value={stats.total} />
          <ProjectorCard title="Warnings flagged" value={stats.warnings} />
          <ProjectorCard title="Current score" value={score.total} />
          <StreakDisplay
            streak={score.streak}
            variant="card"
            reducedMotion={shouldReduceMotion()}
          />
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

      {delivered ? (
        <div className="paper rounded-3xl p-6">
          <div className="font-paper text-xl">Export report</div>
          <div className="ink-muted mt-1 text-sm">
            Download a RAW chart of your journal data (no AI, no tokens).
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <select
              className="focus-ring rounded-2xl border border-[var(--paper-border)] bg-transparent px-3 py-2 text-sm"
              value={rawRange}
              onChange={(e) => setRawRange(e.target.value as RawReportRange)}
            >
              <option value="week">This week</option>
              <option value="last4">Last 4 weeks</option>
              <option value="all">All time</option>
            </select>
            <button
              type="button"
              className="focus-ring inline-flex items-center gap-2 rounded-2xl border border-[var(--paper-border)] px-4 py-3 text-sm font-semibold"
              disabled={rawBusy}
              onClick={handleRawDownload}
            >
              <MaterialIcon name="table_chart" size={20} />
              {rawBusy ? 'Building…' : 'Download RAW report'}
            </button>
          </div>
        </div>
      ) : null}

      {aiEnabled && delivered ? (
        <div className="paper rounded-3xl p-6">
          <div className="font-paper text-xl">AI summary</div>
          <div className="ink-muted mt-1 text-sm">
            Generate a reflection or narrative overview using your configured Worker endpoint.
          </div>
          {profileActiveHint(profile) ? (
            <div className="ink-muted mt-2 text-xs">
              Preferences active: {profileActiveHint(profile)} — open settings (gear) then regenerate
              after edits.
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <ModeToggle mode={mode} onChange={setMode} />
            <WeeklyAiSettingsButton onClick={() => setSettingsOpen(true)} />
            {searchEnabled ? (
              <div className="relative group inline-block">
              <button
                type="button"
                className="focus-ring inline-flex items-center gap-2 rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-sm font-semibold disabled:opacity-50"
                onClick={() => setSearchOpen(true)}
                disabled={!isOnline}
              >
                <MaterialIcon name="search" size={20} />
                Search
              </button>
              {!isOnline && (
                <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                  Internet connection required
                </div>
              )}
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="relative group inline-block">
            <button
              type="button"
              className="btn-primary focus-ring inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
              disabled={summaryBusy || stats.entries.length === 0 || !isOnline}
              onClick={handleGenerate}
            >
              <MaterialIcon name="auto_awesome" size={20} accent={false} />
              {summaryBusy ? 'Generating…' : 'Generate weekly AI summary'}
            </button>
            {!isOnline && (
              <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                Internet connection required
              </div>
            )}
            </div>
            {summary ? (
              <button
                type="button"
                className="focus-ring inline-flex items-center gap-2 rounded-2xl border border-[var(--paper-border)] px-4 py-3 text-sm font-semibold"
                onClick={() => {
                  const md = buildAiSummaryMarkdown({
                    weekKey: stats.weekKey,
                    startDateKey: stats.startDateKey,
                    endDateKey: stats.endDateKey,
                    mode,
                    profile,
                    summary,
                  })
                  downloadTextFile(
                    `mentell-ai-${stats.weekKey}-${mode}.md`,
                    md,
                    'text/markdown;charset=utf-8',
                  )
                }}
              >
                <MaterialIcon name="download" size={20} />
                Download AI summary
              </button>
            ) : null}
          </div>

          {settingsStale ? (
            <div className="ink-muted mt-3 text-sm">
              Preferences changed — regenerate to refresh the summary.
            </div>
          ) : null}

          {fromCache && summary ? (
            <div className="ink-muted mt-3 text-xs">
              Loaded from cache (same week data & preferences).
            </div>
          ) : null}

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

      {/* Search available when AI search enabled even if weekly summary card is off but AI not disabled */}
      {!aiEnabled && searchEnabled && delivered ? (
        <div className="paper rounded-3xl p-6">
          <div className="relative group inline-block">
          <button
            type="button"
            className="focus-ring inline-flex items-center gap-2 rounded-2xl border border-[var(--paper-border)] px-4 py-3 text-sm font-semibold disabled:opacity-50"
            onClick={() => setSearchOpen(true)}
            disabled={!isOnline}
          >
            <MaterialIcon name="search" size={20} />
            Search journals
          </button>
          {!isOnline && (
            <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
              Internet connection required
            </div>
          )}
          </div>
        </div>
      ) : null}

      <WeeklyAiSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={(saved) => {
          const prevFp = profileFingerprint(profile)
          const nextFp = profileFingerprint(saved)
          setProfile(saved)
          if (prevFp !== nextFp) {
            clearWeeklyAiCache()
            setSettingsStale(true)
            setSummary(null)
            setFromCache(false)
          }
        }}
      />

      <ProjectorSearchModal
        open={searchOpen}
        onClose={() => {
          setSearchOpen(false)
          setDebugSearchSeed(null)
        }}
        debugSeed={debugSearchSeed}
      />

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
              <ProjectorEntrySlide key={e.id} entry={e} onClick={() => setSelectedId(e.id)} />
            ))
          )}
        </div>

        {delivered && visibleOlderWeeks.length > 0 ? (
          <div className="mt-6 space-y-6">
            {visibleOlderWeeks.map((batch) => (
              <div key={batch.weekKey}>
                <div className="font-paper text-lg">
                  {batch.weekKey}{' '}
                  <span className="ink-muted text-sm font-sans">· older</span>
                </div>
                <div className="ink-muted mt-0.5 text-xs">
                  {batch.startDateKey} → {batch.endDateKey}
                </div>
                <div className="mt-3 grid gap-3">
                  {batch.entries.map((e) => (
                    <ProjectorEntrySlide
                      key={e.id}
                      entry={e}
                      onClick={() => setSelectedId(e.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {delivered ? (
          <div className="mt-5">
            {olderAnchorWeek !== stats.weekKey || hasMoreWeeks ? (
              <button
                type="button"
                className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--paper-border)] px-4 py-3 text-sm font-semibold disabled:opacity-60"
                disabled={loadingMore}
                onClick={handleShowMore}
              >
                <MaterialIcon name="expand_more" size={22} />
                {loadingMore ? 'Loading…' : 'Show more'}
              </button>
            ) : (
              <div className="ink-muted text-center text-sm">No older weeks with entries.</div>
            )}
          </div>
        ) : null}
      </div>

      <AnimatePresence>
        {selected && delivered ? (
          <motion.div
            className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/35 p-4 sm:p-6"
            initial={shouldReduceMotion() ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={shouldReduceMotion() ? undefined : { opacity: 0 }}
            onClick={() => setSelectedId(null)}
          >
            <motion.div
              className="paper my-auto flex max-h-[min(90dvh,42rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl"
              initial={shouldReduceMotion() ? false : { scale: 0.96, y: 18 }}
              animate={{ scale: 1, y: 0 }}
              exit={shouldReduceMotion() ? undefined : { scale: 0.98, y: 10 }}
              transition={{ duration: motionDuration(0.25) || 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--paper-border)] p-6 pb-4">
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
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 pt-4">
                <ProjectorEntryDetail entry={selected} />
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <SharingPanel />
    </div>
  )
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: AiSummaryMode
  onChange: (m: AiSummaryMode) => void
}) {
  return (
    <div className="flex rounded-2xl border border-[var(--paper-border)] p-1">
      <button
        type="button"
        className={`focus-ring rounded-xl px-3 py-2 text-xs font-semibold ${
          mode === 'reflection' ? 'btn-primary' : ''
        }`}
        onClick={() => onChange('reflection')}
      >
        Reflection
      </button>
      <button
        type="button"
        className={`focus-ring rounded-xl px-3 py-2 text-xs font-semibold ${
          mode === 'overview' ? 'btn-primary' : ''
        }`}
        onClick={() => onChange('overview')}
      >
        Narrative overview
      </button>
    </div>
  )
}

function StatChip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-[3.5rem] items-center gap-1.5 rounded-2xl border border-[var(--paper-border)] px-2 py-1.5 sm:px-3 sm:py-2">
      <div className="font-mono text-base sm:text-lg">{label}</div>
      <div className="text-xs font-medium sm:text-sm">{children}</div>
    </div>
  )
}

function ProjectorCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-3xl border border-[var(--paper-border)] p-4 sm:p-5">
      <div className="ink-muted text-xs sm:text-sm">{title}</div>
      <div className="mt-2 font-mono text-2xl font-black leading-none sm:text-3xl md:text-4xl">
        {value}
      </div>
    </div>
  )
}

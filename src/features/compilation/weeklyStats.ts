<<<<<<< HEAD
import { endOfWeek, format, parseISO, startOfWeek, subWeeks } from 'date-fns'
=======
import { stripDateKey } from '../../shared/dates'
import { endOfWeek, format, parseISO, startOfWeek } from 'date-fns'
>>>>>>> main
import { getDb, type EntryRow } from '../../db/schema'

export type WeeklyStats = {
  weekKey: string
  startDateKey: string
  endDateKey: string
  total: number
  positives: number
  negatives: number
  mixed: number
  warnings: number
  entries: EntryRow[]
}

function toDateKey(d: Date) {
  return format(d, 'yyyy-MM-dd')
}

export function weekKeyForDateKey(dateKey: string) {
<<<<<<< HEAD
  const d = parseISO(dateKey)
=======
  const d = parseISO(stripDateKey(dateKey))
>>>>>>> main
  const wk = format(d, "yyyy-'W'II")
  return wk
}

<<<<<<< HEAD
/** Parse ISO week key like 2026-W20 into a Date within that week (Monday). */
export function dateFromWeekKey(weekKey: string): Date | null {
  const m = weekKey.match(/^(\d{4})-W(\d{2})$/)
  if (!m) return null
  const year = Number(m[1])
  const week = Number(m[2])
  if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) return null
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const day = jan4.getUTCDay() || 7
  const mondayWeek1 = new Date(jan4)
  mondayWeek1.setUTCDate(jan4.getUTCDate() - day + 1)
  const monday = new Date(mondayWeek1)
  monday.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7)
  return new Date(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate())
}

export function previousWeekKey(weekKey: string): string | null {
  const d = dateFromWeekKey(weekKey)
  if (!d) return null
  const prev = subWeeks(d, 1)
  return format(prev, "yyyy-'W'II")
}

export async function getWeeklyStatsForDateKey(dateKey: string): Promise<WeeklyStats> {
  const d = parseISO(dateKey)
=======
export async function getWeeklyStatsForDateKey(dateKey: string): Promise<WeeklyStats> {
  const d = parseISO(stripDateKey(dateKey))
>>>>>>> main
  const start = startOfWeek(d, { weekStartsOn: 1 })
  const end = endOfWeek(d, { weekStartsOn: 1 })

  const startKey = toDateKey(start)
  const endKey = toDateKey(end)

<<<<<<< HEAD
  const entries = (
    await getDb().entries.where('dateKey').between(startKey, endKey, true, true).toArray()
  ).sort((a, b) => b.createdAt - a.createdAt)
=======
  const entriesNorm = await getDb().entries.where('dateKey').between(startKey, endKey, true, true).toArray()
  const entriesBulk = await getDb().entries.where('dateKey').between('~' + startKey, '~' + endKey, true, true).toArray()
  const entries = [...entriesNorm, ...entriesBulk].sort((a, b) => b.createdAt - a.createdAt)
>>>>>>> main

  let positives = 0
  let negatives = 0
  let mixed = 0
  let warnings = 0

  for (const e of entries) {
    if (e.sentiment === '+') positives++
    else if (e.sentiment === '-') negatives++
    else mixed++
    if (e.warningLevel === 'warn') warnings++
  }

  return {
    weekKey: weekKeyForDateKey(dateKey),
    startDateKey: startKey,
    endDateKey: endKey,
    total: entries.length,
    positives,
    negatives,
    mixed,
    warnings,
    entries,
  }
}

export async function getWeeklyStatsForWeekKey(weekKey: string): Promise<WeeklyStats> {
  const rows = await getDb().entries.toArray()
  const entries = rows
    .filter((entry) => weekKeyForDateKey(entry.dateKey) === weekKey)
    .sort((a, b) => b.createdAt - a.createdAt)
  const anchor = entries[0]?.dateKey
  if (!anchor) {
<<<<<<< HEAD
    const d = dateFromWeekKey(weekKey)
    if (d) {
      const startKey = toDateKey(startOfWeek(d, { weekStartsOn: 1 }))
      const endKey = toDateKey(endOfWeek(d, { weekStartsOn: 1 }))
      return {
        weekKey,
        startDateKey: startKey,
        endDateKey: endKey,
        total: 0,
        positives: 0,
        negatives: 0,
        mixed: 0,
        warnings: 0,
        entries: [],
      }
    }
=======
>>>>>>> main
    return {
      weekKey,
      startDateKey: '',
      endDateKey: '',
      total: 0,
      positives: 0,
      negatives: 0,
      mixed: 0,
      warnings: 0,
      entries: [],
    }
  }

<<<<<<< HEAD
  const d = parseISO(anchor)
=======
  const d = parseISO(stripDateKey(anchor))
>>>>>>> main
  const startKey = toDateKey(startOfWeek(d, { weekStartsOn: 1 }))
  const endKey = toDateKey(endOfWeek(d, { weekStartsOn: 1 }))

  let positives = 0
  let negatives = 0
  let mixed = 0
  let warnings = 0

  for (const e of entries) {
    if (e.sentiment === '+') positives++
    else if (e.sentiment === '-') negatives++
    else mixed++
    if (e.warningLevel === 'warn') warnings++
  }

  return {
    weekKey,
    startDateKey: startKey,
    endDateKey: endKey,
    total: entries.length,
    positives,
    negatives,
    mixed,
    warnings,
    entries,
  }
}
<<<<<<< HEAD

export type WeekCursor = { beforeWeekKey: string } | null

/**
 * Load one week of entries before the cursor (or before anchorWeekKey on first call).
 * Skips empty weeks until a week with entries is found (or history is exhausted).
 */
export async function getEntriesForWeeksBefore(
  anchorWeekKey: string,
  cursor: WeekCursor,
  weekCount = 1,
): Promise<{
  batches: Array<{ weekKey: string; startDateKey: string; endDateKey: string; entries: EntryRow[] }>
  nextCursor: WeekCursor
}> {
  const batches: Array<{
    weekKey: string
    startDateKey: string
    endDateKey: string
    entries: EntryRow[]
  }> = []

  let current = cursor?.beforeWeekKey
    ? previousWeekKey(cursor.beforeWeekKey)
    : previousWeekKey(anchorWeekKey)
  let safety = 0
  const maxSkip = 104

  while (current && batches.length < weekCount && safety < maxSkip) {
    safety++
    const stats = await getWeeklyStatsForWeekKey(current)
    if (stats.entries.length > 0) {
      batches.push({
        weekKey: stats.weekKey,
        startDateKey: stats.startDateKey,
        endDateKey: stats.endDateKey,
        entries: stats.entries,
      })
    }
    current = previousWeekKey(current)
  }

  let nextCursor: WeekCursor = null
  if (batches.length > 0) {
    const lastLoaded = batches[batches.length - 1].weekKey
    // Probe whether anything older exists
    let probe = previousWeekKey(lastLoaded)
    let probeSafety = 0
    while (probe && probeSafety < maxSkip) {
      probeSafety++
      const stats = await getWeeklyStatsForWeekKey(probe)
      if (stats.entries.length > 0) {
        nextCursor = { beforeWeekKey: lastLoaded }
        break
      }
      probe = previousWeekKey(probe)
    }
  } else if (current) {
    // No batch found but we stopped early — allow retry from same cursor
    nextCursor = cursor
  }

  return { batches, nextCursor }
}
=======
>>>>>>> main

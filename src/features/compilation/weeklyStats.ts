import { endOfWeek, format, parseISO, startOfWeek } from 'date-fns'
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
  const d = parseISO(dateKey)
  const wk = format(d, "yyyy-'W'II")
  return wk
}

export async function getWeeklyStatsForDateKey(dateKey: string): Promise<WeeklyStats> {
  const d = parseISO(dateKey)
  const start = startOfWeek(d, { weekStartsOn: 1 })
  const end = endOfWeek(d, { weekStartsOn: 1 })

  const startKey = toDateKey(start)
  const endKey = toDateKey(end)

  const entries = (
    await getDb().entries.where('dateKey').between(startKey, endKey, true, true).toArray()
  ).sort((a, b) => b.createdAt - a.createdAt)

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

  const d = parseISO(anchor)
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

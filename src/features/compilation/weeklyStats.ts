import { endOfWeek, format, parseISO, startOfWeek } from 'date-fns'
import { db, type EntryRow } from '../../db/schema'

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
    await db.entries.where('dateKey').between(startKey, endKey, true, true).toArray()
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


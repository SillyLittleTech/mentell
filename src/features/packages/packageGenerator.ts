import { eachWeekOfInterval, endOfWeek, parseISO, startOfWeek, subWeeks } from 'date-fns'
import { db } from '../../db/schema'
import { ensurePackage } from './packageService'
import { weekKeyForDateKey } from '../compilation/weeklyStats'

export async function generateDuePackages(now: Date = new Date()) {
  const first = await db.entries.orderBy('dateKey').first()
  const last = await db.entries.orderBy('dateKey').last()
  if (!first || !last) return

  // Only generate *completed* weeks (previous week and earlier).
  const lastCompleteWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
  const lastCompleteWeekStart = startOfWeek(lastCompleteWeekEnd, { weekStartsOn: 1 })

  const firstWeekStart = startOfWeek(parseISO(first.dateKey), { weekStartsOn: 1 })
  if (firstWeekStart > lastCompleteWeekStart) return

  const weeks = eachWeekOfInterval(
    { start: firstWeekStart, end: lastCompleteWeekStart },
    { weekStartsOn: 1 },
  )

  for (const wStart of weeks) {
    const wEnd = endOfWeek(wStart, { weekStartsOn: 1 })
    const startKey = wStart.toISOString().slice(0, 10)
    const endKey = wEnd.toISOString().slice(0, 10)

    const count = await db.entries.where('dateKey').between(startKey, endKey, true, true).count()
    if (count <= 0) continue
    await ensurePackage('weekly', weekKeyForDateKey(startKey))
  }
}


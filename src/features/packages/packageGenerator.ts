import { eachWeekOfInterval, endOfWeek, format, parseISO, startOfWeek, subWeeks } from 'date-fns'
import { getDb } from '../../db/schema'
import { ensurePackage } from './packageService'
import { weekKeyForDateKey } from '../compilation/weeklyStats'

export async function generateDuePackages(now: Date = new Date()) {
  const first = await getDb().entries.orderBy('dateKey').first()
  const last = await getDb().entries.orderBy('dateKey').last()
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
    const startKey = format(wStart, 'yyyy-MM-dd')
    const endKey = format(wEnd, 'yyyy-MM-dd')

    const count = await getDb().entries.where('dateKey').between(startKey, endKey, true, true).count()
    if (count <= 0) continue
    await ensurePackage('weekly', weekKeyForDateKey(startKey))
  }
}


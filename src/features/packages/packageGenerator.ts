import { eachWeekOfInterval, endOfWeek, format, parseISO, startOfWeek, subWeeks } from 'date-fns'
import type { PackageRow } from '../../db/schema'
import { getDb } from '../../db/schema'
import { loadAppSettings } from '../../shared/settings/appSettings'
import { ensurePackage } from './packageService'
import { weekKeyForDateKey } from '../compilation/weeklyStats'
import { isWeekDeliverable } from './packageDelivery'

export async function generateDuePackages(now: Date = new Date()) {
  const settings = loadAppSettings()
  const created: PackageRow[] = []
  const first = await getDb().entries.orderBy('dateKey').first()
  const last = await getDb().entries.orderBy('dateKey').last()
  if (!first || !last) return { created }

  // Only generate *completed* weeks (previous week and earlier).
  const lastCompleteWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
  const lastCompleteWeekStart = startOfWeek(lastCompleteWeekEnd, { weekStartsOn: 1 })

  const firstWeekStart = startOfWeek(parseISO(first.dateKey), { weekStartsOn: 1 })
  if (firstWeekStart > lastCompleteWeekStart) return { created }

  const weeks = eachWeekOfInterval(
    { start: firstWeekStart, end: lastCompleteWeekStart },
    { weekStartsOn: 1 },
  )

  for (const wStart of weeks) {
    if (!isWeekDeliverable(wStart, now, settings)) continue

    const wEnd = endOfWeek(wStart, { weekStartsOn: 1 })
    const startKey = format(wStart, 'yyyy-MM-dd')
    const endKey = format(wEnd, 'yyyy-MM-dd')

    const count = await getDb().entries.where('dateKey').between(startKey, endKey, true, true).count()
    if (count <= 0) continue

    const existing = await getDb().packages
      .where({ kind: 'weekly', periodKey: weekKeyForDateKey(startKey) })
      .first()
    if (existing) continue

    const row = await ensurePackage('weekly', weekKeyForDateKey(startKey))
    created.push(row)
  }

  return { created }
}

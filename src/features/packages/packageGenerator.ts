import { stripDateKey } from '../../shared/dates'
import { eachWeekOfInterval, endOfWeek, format, parseISO, startOfWeek, subWeeks, endOfMonth, startOfMonth, subMonths, eachMonthOfInterval, endOfYear, startOfYear, subYears, eachYearOfInterval } from 'date-fns'
import type { PackageRow } from '../../db/schema'
import { getDb } from '../../db/schema'
import { loadAppSettings } from '../../shared/settings/appSettings'
import { ensurePackageWithStatus } from './packageService'
import { weekKeyForDateKey } from '../compilation/weeklyStats'
import { isWeekDeliverable, isMonthDeliverable, isYearDeliverable } from './packageDelivery'

export async function generateDuePackages(now: Date = new Date()) {
  const settings = loadAppSettings()
  const created: PackageRow[] = []
  const first = await getDb().entries.orderBy('dateKey').first()
  const last = await getDb().entries.orderBy('dateKey').last()
  if (!first || !last) return { created }

  // Only generate *completed* weeks (previous week and earlier).
  const lastCompleteWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
  const lastCompleteWeekStart = startOfWeek(lastCompleteWeekEnd, { weekStartsOn: 1 })

  const firstWeekStart = startOfWeek(parseISO(stripDateKey(first.dateKey)), { weekStartsOn: 1 })
  if (firstWeekStart <= lastCompleteWeekStart) {
    const weeks = eachWeekOfInterval(
      { start: firstWeekStart, end: lastCompleteWeekStart },
      { weekStartsOn: 1 },
    )

    for (const wStart of weeks) {
      if (!isWeekDeliverable(wStart, now, settings)) continue

      const wEnd = endOfWeek(wStart, { weekStartsOn: 1 })
      const startKey = format(wStart, 'yyyy-MM-dd')
      const endKey = format(wEnd, 'yyyy-MM-dd')

      const countNorm = await getDb().entries.where('dateKey').between(startKey, endKey, true, true).count()
      const countBulk = await getDb().entries.where('dateKey').between('~' + startKey, '~' + endKey, true, true).count()
      const count = countNorm + countBulk
      if (count <= 0) continue

      const result = await ensurePackageWithStatus('weekly', weekKeyForDateKey(startKey))
      if (result.created) created.push(result.row)
    }
  }

  const lastCompleteMonthEnd = endOfMonth(subMonths(now, 1))
  const lastCompleteMonthStart = startOfMonth(lastCompleteMonthEnd)
  const firstMonthStart = startOfMonth(parseISO(stripDateKey(first.dateKey)))

  if (firstMonthStart <= lastCompleteMonthStart) {
    const months = eachMonthOfInterval({ start: firstMonthStart, end: lastCompleteMonthStart })
    for (const mStart of months) {
      if (!isMonthDeliverable(mStart, now, settings)) continue

      const mEnd = endOfMonth(mStart)
      const startKey = format(mStart, 'yyyy-MM-dd')
      const endKey = format(mEnd, 'yyyy-MM-dd')

      const countNorm = await getDb().entries.where('dateKey').between(startKey, endKey, true, true).count()
      const countBulk = await getDb().entries.where('dateKey').between('~' + startKey, '~' + endKey, true, true).count()
      const count = countNorm + countBulk
      if (count <= 0) continue

      const periodKey = format(mStart, 'yyyy-MM')
      const result = await ensurePackageWithStatus('monthly', periodKey)
      if (result.created) created.push(result.row)
    }
  }

  const lastCompleteYearEnd = endOfYear(subYears(now, 1))
  const lastCompleteYearStart = startOfYear(lastCompleteYearEnd)
  const firstYearStart = startOfYear(parseISO(stripDateKey(first.dateKey)))

  if (firstYearStart <= lastCompleteYearStart) {
    const years = eachYearOfInterval({ start: firstYearStart, end: lastCompleteYearStart })
    for (const yStart of years) {
      if (!isYearDeliverable(yStart, now, settings)) continue

      const yEnd = endOfYear(yStart)
      const startKey = format(yStart, 'yyyy-MM-dd')
      const endKey = format(yEnd, 'yyyy-MM-dd')

      const countNorm = await getDb().entries.where('dateKey').between(startKey, endKey, true, true).count()
      const countBulk = await getDb().entries.where('dateKey').between('~' + startKey, '~' + endKey, true, true).count()
      const count = countNorm + countBulk
      if (count <= 0) continue

      const periodKey = format(yStart, 'yyyy')
      const result = await ensurePackageWithStatus('yearly', periodKey)
      if (result.created) created.push(result.row)
    }
  }

  return { created }
}

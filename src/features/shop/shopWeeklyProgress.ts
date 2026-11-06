import { addDays, format, parseISO, startOfWeek } from 'date-fns'
import { getDb, type EntryRow } from '../../db/schema'
import { dateKeyForLocalDay, stripDateKey } from '../../shared/dates'
import {
  aggregateEntriesForDay,
  classForSentiment,
  pickDayClass,
  strongestSentiment,
  type FeelingDayClass,
} from '../compilation/feelingsSemantics'

export type ShopWeekDay = {
  dateKey: string
  label: string
  shortLabel: string
  feelingClass: FeelingDayClass
}

function toDateKey(d: Date) {
  return format(d, 'yyyy-MM-dd')
}

export async function getShopWeekDays(
  anchorDateKey: string = dateKeyForLocalDay(new Date()),
): Promise<ShopWeekDay[]> {
  const anchor = parseISO(stripDateKey(anchorDateKey))
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 })
  const todayKey = dateKeyForLocalDay(new Date())

  const weekEndKey = toDateKey(addDays(weekStart, 6))

  const entriesNorm = await getDb()
    .entries.where('dateKey')
    .between(toDateKey(weekStart), weekEndKey, true, true)
    .toArray()
  const entriesBulk = await getDb()
    .entries.where('dateKey')
    .between('~' + toDateKey(weekStart), '~' + weekEndKey, true, true)
    .toArray()
  const entries: EntryRow[] = [...entriesNorm, ...entriesBulk]

  const byDay = new Map<string, EntryRow[]>()
  for (const e of entries) {
    const dk = stripDateKey(e.dateKey)
    const list = byDay.get(dk) ?? []
    list.push(e)
    byDay.set(dk, list)
  }

  const firstRow = await getDb().entries.orderBy('dateKey').first()
  const firstEntryDate = firstRow ? stripDateKey(firstRow.dateKey) : null

  const days: ShopWeekDay[] = []
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i)
    const dateKey = toDateKey(d)
    const list = byDay.get(dateKey) ?? []
    const agg = aggregateEntriesForDay(list)
    const hasEntry = Boolean(agg)
    const combined = hasEntry
      ? list.reduce((acc, row) => strongestSentiment(acc, row.sentiment), list[0].sentiment)
      : '='
    const feelingClass = hasEntry
      ? classForSentiment(combined)
      : pickDayClass(false, '=', dateKey, todayKey, firstEntryDate)

    days.push({
      dateKey,
      label: format(d, 'EEE'),
      shortLabel: format(d, 'EEEEE'),
      feelingClass,
    })
  }

  return days
}

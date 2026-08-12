import { addDays, endOfWeek, endOfMonth, endOfYear, set, startOfWeek } from 'date-fns'
import type { AppSettings } from '../../shared/settings/appSettings'

function parseTimeLocal(timeLocal: string): { hours: number; minutes: number } {
  const [h, m] = timeLocal.split(':').map((v) => Number(v))
  return { hours: h, minutes: m }
}

/** Offset from Monday (weekStartsOn: 1) to the target weekday (0=Sun … 6=Sat). */
function weekdayOffsetFromMonday(weekday: number): number {
  return weekday === 0 ? 6 : weekday - 1
}

/**
 * First local instant on/after the journal week ends (Mon–Sun) at the configured weekday + time.
 * If that slot falls before week end, the next week's slot is used (e.g. Mon 9:00 after Sun close).
 */
export function getDeliveryInstantForWeek(
  weekStart: Date,
  weekday: number,
  timeLocal: string,
): Date {
  const { hours, minutes } = parseTimeLocal(timeLocal)
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
  const monday = startOfWeek(weekStart, { weekStartsOn: 1 })
  let candidate = set(addDays(monday, weekdayOffsetFromMonday(weekday)), {
    hours,
    minutes,
    seconds: 0,
    milliseconds: 0,
  })
  if (candidate <= weekEnd) {
    candidate = addDays(candidate, 7)
  }
  return candidate
}

export function isWeekDeliverable(
  weekStart: Date,
  now: Date,
  settings: Pick<AppSettings, 'deliveryWeekday' | 'deliveryTimeLocal'>,
): boolean {
  const deliveryAt = getDeliveryInstantForWeek(
    weekStart,
    settings.deliveryWeekday,
    settings.deliveryTimeLocal,
  )
  return now >= deliveryAt
}


/**
 * First local instant on/after the month ends at the configured weekday + time.
 */
export function getDeliveryInstantForMonth(
  monthStart: Date,
  weekday: number,
  timeLocal: string,
): Date {
  const { hours, minutes } = parseTimeLocal(timeLocal)
  const monthEnd = endOfMonth(monthStart)

  const nextMonthStart = addDays(monthEnd, 1)
  nextMonthStart.setHours(0, 0, 0, 0)
  const firstMonday = startOfWeek(nextMonthStart, { weekStartsOn: 1 })

  let candidate = set(addDays(firstMonday, weekdayOffsetFromMonday(weekday)), {
    hours,
    minutes,
    seconds: 0,
    milliseconds: 0,
  })

  if (candidate < nextMonthStart) {
    candidate = addDays(candidate, 7)
  }
  return candidate
}

export function isMonthDeliverable(
  monthStart: Date,
  now: Date,
  settings: Pick<AppSettings, 'deliveryWeekday' | 'deliveryTimeLocal'>,
): boolean {
  const deliveryAt = getDeliveryInstantForMonth(
    monthStart,
    settings.deliveryWeekday,
    settings.deliveryTimeLocal,
  )
  return now >= deliveryAt
}

/**
 * First local instant on/after the year ends at the configured weekday + time.
 */
export function getDeliveryInstantForYear(
  yearStart: Date,
  weekday: number,
  timeLocal: string,
): Date {
  const { hours, minutes } = parseTimeLocal(timeLocal)
  const yearEnd = endOfYear(yearStart)

  const nextYearStart = addDays(yearEnd, 1)
  nextYearStart.setHours(0, 0, 0, 0)
  const firstMonday = startOfWeek(nextYearStart, { weekStartsOn: 1 })

  let candidate = set(addDays(firstMonday, weekdayOffsetFromMonday(weekday)), {
    hours,
    minutes,
    seconds: 0,
    milliseconds: 0,
  })

  if (candidate < nextYearStart) {
    candidate = addDays(candidate, 7)
  }
  return candidate
}

export function isYearDeliverable(
  yearStart: Date,
  now: Date,
  settings: Pick<AppSettings, 'deliveryWeekday' | 'deliveryTimeLocal'>,
): boolean {
  const deliveryAt = getDeliveryInstantForYear(
    yearStart,
    settings.deliveryWeekday,
    settings.deliveryTimeLocal,
  )
  return now >= deliveryAt
}

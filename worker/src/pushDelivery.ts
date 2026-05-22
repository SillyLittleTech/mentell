import { endOfWeek, format, parseISO, startOfWeek, subWeeks } from 'date-fns'

export const GENERIC_PUSH_TIMEZONE = 'America/New_York'

const WEEKDAY_SHORT: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

export function dateKeyInTimeZone(now: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function localTimeParts(now: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]))
  const weekday = WEEKDAY_SHORT[parts.weekday ?? ''] ?? 0
  const hour = Number(parts.hour ?? 0)
  const minute = Number(parts.minute ?? 0)
  return { weekday, hour, minute }
}

export function inDeliveryWindow(
  now: Date,
  deliveryWeekday: number,
  deliveryTimeLocal: string,
  timeZone: string,
  windowMinutes = 15,
) {
  const { weekday, hour, minute } = localTimeParts(now, timeZone)
  if (weekday !== deliveryWeekday) return false
  const m = deliveryTimeLocal.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return false
  const startMins = Number(m[1]) * 60 + Number(m[2])
  const nowMins = hour * 60 + minute
  return nowMins >= startMins && nowMins < startMins + windowMinutes
}

export function lastCompletedWeekRange(now: Date, timeZone: string) {
  const todayKey = dateKeyInTimeZone(now, timeZone)
  const today = parseISO(todayKey)
  const lastCompleteWeekEnd = endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 })
  const lastCompleteWeekStart = startOfWeek(lastCompleteWeekEnd, { weekStartsOn: 1 })
  return {
    weekKey: format(lastCompleteWeekStart, "yyyy-'W'II"),
    startKey: format(lastCompleteWeekStart, 'yyyy-MM-dd'),
    endKey: format(lastCompleteWeekEnd, 'yyyy-MM-dd'),
  }
}

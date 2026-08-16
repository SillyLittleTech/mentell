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
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]))
  const weekday = WEEKDAY_SHORT[(parts.weekday ?? '').replace(/\.$/, '')] ?? 0
  let hour = Number(parts.hour ?? 0)
  if (hour === 24) hour = 0
  const minute = Number(parts.minute ?? 0)
  return { weekday, hour, minute }
}

/**
 * True from the configured local weekday+time until the next weekly slot.
 * Cron is every 15 minutes and can jitter past a tight window; weekly KV
 * dedupe prevents double-sends, so a full-week window is safe and required
 * for background delivery while the app is closed.
 */
export function inDeliveryWindow(
  now: Date,
  deliveryWeekday: number,
  deliveryTimeLocal: string,
  timeZone: string,
  windowMinutes = 7 * 24 * 60,
) {
  const { weekday, hour, minute } = localTimeParts(now, timeZone)
  const m = deliveryTimeLocal.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return false
  const startMins = Number(m[1]) * 60 + Number(m[2])
  const nowMins = hour * 60 + minute
  const daysAgo = (weekday - deliveryWeekday + 7) % 7
  const elapsed = daysAgo * 24 * 60 + (nowMins - startMins)
  if (elapsed < 0) return false
  return elapsed < windowMinutes
}

export function lastCompletedWeekRange(now: Date, timeZone: string) {
  const today = parseDateKeyAsUtc(dateKeyInTimeZone(now, timeZone))
  const currentWeekStart = mondayStartUtc(today)
  const lastCompleteWeekStart = addDaysUtc(currentWeekStart, -7)
  const lastCompleteWeekEnd = addDaysUtc(lastCompleteWeekStart, 6)
  const week = isoWeekParts(lastCompleteWeekStart)
  return {
    weekKey: `${week.year}-W${String(week.week).padStart(2, '0')}`,
    startKey: formatUtcDateKey(lastCompleteWeekStart),
    endKey: formatUtcDateKey(lastCompleteWeekEnd),
  }
}

function parseDateKeyAsUtc(dateKey: string) {
  const m = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) throw new Error(`Invalid date key: ${dateKey}`)
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
}

function addDaysUtc(date: Date, days: number) {
  const next = new Date(date.getTime())
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function mondayStartUtc(date: Date) {
  const offset = (date.getUTCDay() + 6) % 7
  return addDaysUtc(date, -offset)
}

function formatUtcDateKey(date: Date) {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isoWeekParts(mondayDate: Date) {
  const thursday = addDaysUtc(mondayDate, 3)
  const year = thursday.getUTCFullYear()
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Monday = mondayStartUtc(jan4)
  const days = Math.floor((mondayDate.getTime() - jan4Monday.getTime()) / 86_400_000)
  return { year, week: Math.floor(days / 7) + 1 }
}

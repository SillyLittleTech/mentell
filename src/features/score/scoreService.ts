import { addDays, parseISO } from 'date-fns'
import { db } from '../../db/schema'
import { isPointsEnabled } from '../../shared/settings/appSettings'

/** Each extra log the same day earns this fraction of the previous log's nominal award. */
const DAILY_LOG_DECAY = 0.5

const SCORE_KEY = 'mentell.score.total'
const STREAK_KEY = 'mentell.score.streak'
const LAST_DAY_KEY = 'mentell.score.lastDay'

export type ScoreResult = {
  base: number
  bonus: number
  /** 1 for first log of the day; 0.5, 0.25, … for additional logs */
  dailyMultiplier: number
  logsTodayBefore: number
  totalDelta: number
  nextTotal: number
  nextStreak: number
  hint: string | null
}

export type PackageOpenResult = {
  delta: number
  nextTotal: number
  hint: string
}

export type SpendScoreResult =
  | { ok: true; spent: number; nextTotal: number }
  | { ok: false; spent: number; nextTotal: number; reason: 'insufficient' | 'invalid' }

function getInt(key: string, fallback: number) {
  const raw = localStorage.getItem(key)
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function setInt(key: string, value: number) {
  localStorage.setItem(key, String(Math.trunc(value)))
}

function isConsecutiveDay(prevDateKey: string, nextDateKey: string) {
  try {
    const prev = parseISO(prevDateKey)
    const next = parseISO(nextDateKey)
    const expected = addDays(prev, 1)
    return expected.toISOString().slice(0, 10) === next.toISOString().slice(0, 10)
  } catch {
    return false
  }
}

function dailyLogMultiplier(logsTodayBefore: number) {
  return Math.pow(DAILY_LOG_DECAY, logsTodayBefore)
}

function buildAwardHint(
  logsTodayBefore: number,
  dailyMultiplier: number,
  totalDelta: number,
  bonus: number,
  nextStreak: number,
) {
  const parts: string[] = []

  if (logsTodayBefore > 0) {
    const pct = Math.round(dailyMultiplier * 100)
    const ordinal =
      logsTodayBefore === 1 ? '2nd' : logsTodayBefore === 2 ? '3rd' : `${logsTodayBefore + 1}th`
    parts.push(`${ordinal} log today (${pct}% points, +${totalDelta})`)
  } else if (bonus > 0) {
    parts.push(
      nextStreak === 2
        ? `Streak bonus unlocked (+${bonus})`
        : `Streak x${nextStreak} bonus (+${bonus})`,
    )
  }

  return parts.length ? parts.join(' · ') : null
}

export async function awardForSubmission(dateKey: string): Promise<ScoreResult> {
  if (!isPointsEnabled()) {
    const streak = getInt(STREAK_KEY, 0)
    return {
      base: 0,
      bonus: 0,
      dailyMultiplier: 1,
      logsTodayBefore: 0,
      totalDelta: 0,
      nextTotal: getInt(SCORE_KEY, 0),
      nextStreak: streak,
      hint: null,
    }
  }

  const logsTodayBefore = await db.entries.where('dateKey').equals(dateKey).count()
  const dailyMultiplier = dailyLogMultiplier(logsTodayBefore)

  const total = getInt(SCORE_KEY, 0)
  const streak = getInt(STREAK_KEY, 0)
  const lastDay = localStorage.getItem(LAST_DAY_KEY)

  const nextStreak =
    lastDay && isConsecutiveDay(lastDay, dateKey) ? streak + 1 : dateKey === lastDay ? streak : 1

  const base = 100
  const bonus = nextStreak >= 2 ? 50 + Math.max(0, nextStreak - 2) * 25 : 0
  const nominal = base + bonus
  const totalDelta = Math.max(0, Math.round(nominal * dailyMultiplier))
  const nextTotal = total + totalDelta

  setInt(SCORE_KEY, nextTotal)
  setInt(STREAK_KEY, nextStreak)
  localStorage.setItem(LAST_DAY_KEY, dateKey)

  const hint = buildAwardHint(logsTodayBefore, dailyMultiplier, totalDelta, bonus, nextStreak)

  return {
    base,
    bonus,
    dailyMultiplier,
    logsTodayBefore,
    totalDelta,
    nextTotal,
    nextStreak,
    hint,
  }
}

export function getScoreSnapshot() {
  return {
    total: getInt(SCORE_KEY, 0),
    streak: getInt(STREAK_KEY, 0),
    lastDay: localStorage.getItem(LAST_DAY_KEY),
  }
}

export function spendScore(spent: number): SpendScoreResult {
  if (!isPointsEnabled()) {
    return { ok: false, spent: 0, nextTotal: getInt(SCORE_KEY, 0), reason: 'invalid' }
  }

  const clean = Math.trunc(spent)
  if (!Number.isFinite(clean) || clean <= 0) {
    return { ok: false, spent: clean, nextTotal: getInt(SCORE_KEY, 0), reason: 'invalid' }
  }

  const total = getInt(SCORE_KEY, 0)
  if (total < clean) {
    return { ok: false, spent: clean, nextTotal: total, reason: 'insufficient' }
  }

  const nextTotal = total - clean
  setInt(SCORE_KEY, nextTotal)
  return { ok: true, spent: clean, nextTotal }
}

function packageDelta(kind: 'weekly' | 'monthly' | 'yearly') {
  // Scales with length: weekly < monthly < yearly, always bigger than a daily submit.
  if (kind === 'yearly') return 12000
  if (kind === 'monthly') return 3000
  return 600
}

export function awardForPackageOpen(kind: 'weekly' | 'monthly' | 'yearly'): PackageOpenResult {
  if (!isPointsEnabled()) {
    return { delta: 0, nextTotal: getInt(SCORE_KEY, 0), hint: '' }
  }

  const total = getInt(SCORE_KEY, 0)
  const delta = packageDelta(kind)
  const nextTotal = total + delta
  setInt(SCORE_KEY, nextTotal)

  const hint =
    kind === 'yearly'
      ? `Yearly package bonus (+${delta})`
      : kind === 'monthly'
        ? `Monthly package bonus (+${delta})`
        : `Weekly package bonus (+${delta})`

  return { delta, nextTotal, hint }
}


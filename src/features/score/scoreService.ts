import { addDays, parseISO } from 'date-fns'

const SCORE_KEY = 'mentell.score.total'
const STREAK_KEY = 'mentell.score.streak'
const LAST_DAY_KEY = 'mentell.score.lastDay'

export type ScoreResult = {
  base: number
  bonus: number
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

export function awardForSubmission(dateKey: string): ScoreResult {
  const total = getInt(SCORE_KEY, 0)
  const streak = getInt(STREAK_KEY, 0)
  const lastDay = localStorage.getItem(LAST_DAY_KEY)

  const nextStreak =
    lastDay && isConsecutiveDay(lastDay, dateKey) ? streak + 1 : dateKey === lastDay ? streak : 1

  const base = 100
  const bonus = nextStreak >= 2 ? 50 + Math.max(0, nextStreak - 2) * 25 : 0
  const totalDelta = base + bonus
  const nextTotal = total + totalDelta

  setInt(SCORE_KEY, nextTotal)
  setInt(STREAK_KEY, nextStreak)
  localStorage.setItem(LAST_DAY_KEY, dateKey)

  const hint =
    bonus > 0
      ? nextStreak === 2
        ? `Streak bonus unlocked (+${bonus})`
        : `Streak x${nextStreak} bonus (+${bonus})`
      : null

  return { base, bonus, totalDelta, nextTotal, nextStreak, hint }
}

export function getScoreSnapshot() {
  return {
    total: getInt(SCORE_KEY, 0),
    streak: getInt(STREAK_KEY, 0),
    lastDay: localStorage.getItem(LAST_DAY_KEY),
  }
}

function packageDelta(kind: 'weekly' | 'monthly' | 'yearly') {
  // Scales with length: weekly < monthly < yearly, always bigger than a daily submit.
  if (kind === 'yearly') return 12000
  if (kind === 'monthly') return 3000
  return 600
}

export function awardForPackageOpen(kind: 'weekly' | 'monthly' | 'yearly'): PackageOpenResult {
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


import { stripDateKey } from '../../shared/dates'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { getDb } from '../../db/schema'
import { isPointsEnabled } from '../../shared/settings/appSettings'
import { scopedStorageKey } from '../../shared/storage/storageScope'
import { notifyLocalDataChanged } from '../../shared/sync/localDataEvents'

/** Each extra log the same day earns this fraction of the previous log's nominal award. */
const DAILY_LOG_DECAY = 0.5

const SCORE_KEY = scopedStorageKey('mentell.score.total')
const STREAK_KEY = scopedStorageKey('mentell.score.streak')
const LAST_DAY_KEY = scopedStorageKey('mentell.score.lastDay')
const STREAK_FREEZE_KEY = scopedStorageKey('mentell.score.streakFreezes')
export const SCORE_UPDATED_AT_KEY = scopedStorageKey('mentell.score.updatedAt')

export const STREAK_FREEZE_COST = 2000
export const STREAK_FREEZE_MAX = 3
export const STREAK_RESTORE_COST = 6000
const STREAK_RESTORE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export type ScoreResult = {
  base: number
  bonus: number
  /** 1 for first log of the day; 0.5, 0.25, … for additional logs */
  dailyMultiplier: number
  logsTodayBefore: number
  totalDelta: number
  nextTotal: number
  nextStreak: number
  previousStreak: number
  previousStreakFreezes: number
  nextStreakFreezes: number
  streakBroken: boolean
  freezeConsumed: boolean
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

export type BuyStreakFreezeResult =
  | { ok: true; spent: number; nextTotal: number; nextFreezes: number }
  | { ok: false; spent: number; nextTotal: number; nextFreezes: number; reason: 'insufficient' | 'invalid' | 'max' }

export type StreakRestoreCandidate = {
  streak: number
  restoreTo: number
  lastDay: string
  brokenDateKey: string
  brokenAt: number
  missedDays: number
}

export type BuyStreakRestoreResult =
  | { ok: true; spent: number; nextTotal: number; restoredStreak: number }
  | { ok: false; spent: number; nextTotal: number; reason: 'insufficient' | 'invalid' | 'none' }

const STREAK_RESTORE_KEY = scopedStorageKey('mentell.score.streakRestore')

function getInt(key: string, fallback: number) {
  const raw = localStorage.getItem(key)
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function setInt(key: string, value: number) {
  localStorage.setItem(key, String(Math.trunc(value)))
}

function readRestoreCandidate(): StreakRestoreCandidate | null {
  try {
    const raw = localStorage.getItem(STREAK_RESTORE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StreakRestoreCandidate>
    if (
      typeof parsed.streak !== 'number' ||
      typeof parsed.restoreTo !== 'number' ||
      typeof parsed.lastDay !== 'string' ||
      typeof parsed.brokenDateKey !== 'string' ||
      typeof parsed.brokenAt !== 'number' ||
      typeof parsed.missedDays !== 'number'
    ) {
      return null
    }
    if (Date.now() - parsed.brokenAt > STREAK_RESTORE_WINDOW_MS) {
      localStorage.removeItem(STREAK_RESTORE_KEY)
      return null
    }
    return {
      streak: Math.max(0, Math.trunc(parsed.streak)),
      restoreTo: Math.max(0, Math.trunc(parsed.restoreTo)),
      lastDay: parsed.lastDay,
      brokenDateKey: parsed.brokenDateKey,
      brokenAt: Math.trunc(parsed.brokenAt),
      missedDays: Math.max(1, Math.trunc(parsed.missedDays)),
    }
  } catch {
    return null
  }
}

function writeRestoreCandidate(candidate: StreakRestoreCandidate | null) {
  if (!candidate) {
    localStorage.removeItem(STREAK_RESTORE_KEY)
    return
  }
  localStorage.setItem(STREAK_RESTORE_KEY, JSON.stringify(candidate))
}

function sanitizeRestoreCandidate(candidate: StreakRestoreCandidate | null) {
  if (!candidate) return null
  if (
    typeof candidate.streak !== 'number' ||
    typeof candidate.restoreTo !== 'number' ||
    typeof candidate.lastDay !== 'string' ||
    typeof candidate.brokenDateKey !== 'string' ||
    typeof candidate.brokenAt !== 'number' ||
    typeof candidate.missedDays !== 'number'
  ) {
    return null
  }
  if (Date.now() - candidate.brokenAt > STREAK_RESTORE_WINDOW_MS) {
    return null
  }
  return {
    streak: Math.max(0, Math.trunc(candidate.streak)),
    restoreTo: Math.max(0, Math.trunc(candidate.restoreTo)),
    lastDay: candidate.lastDay,
    brokenDateKey: candidate.brokenDateKey,
    brokenAt: Math.trunc(candidate.brokenAt),
    missedDays: Math.max(1, Math.trunc(candidate.missedDays)),
  }
}

function isConsecutiveDay(prevDateKey: string, nextDateKey: string) {
  try {
    const prev = parseISO(stripDateKey(prevDateKey))
    const next = parseISO(stripDateKey(nextDateKey))
    return differenceInCalendarDays(next, prev) === 1
  } catch {
    return false
  }
}

function dayGap(prevDateKey: string, nextDateKey: string) {
  try {
    return differenceInCalendarDays(parseISO(stripDateKey(nextDateKey)), parseISO(stripDateKey(prevDateKey)))
  } catch {
    return null
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
  freezeConsumed: boolean,
) {
  const parts: string[] = []

  if (freezeConsumed) {
    parts.push('Streak freeze used')
  }

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
      previousStreak: streak,
      previousStreakFreezes: getInt(STREAK_FREEZE_KEY, 0),
      nextStreakFreezes: getInt(STREAK_FREEZE_KEY, 0),
      streakBroken: false,
      freezeConsumed: false,
      hint: null,
    }
  }

  const logsTodayBefore = await getDb().entries.where('dateKey').equals(dateKey).count()
  const dailyMultiplier = dailyLogMultiplier(logsTodayBefore)

  const total = getInt(SCORE_KEY, 0)
  const streak = getInt(STREAK_KEY, 0)
  const lastDay = localStorage.getItem(LAST_DAY_KEY)
  const freezes = getInt(STREAK_FREEZE_KEY, 0)
  const gap = lastDay ? dayGap(lastDay, dateKey) : null
  const freezeConsumed = Boolean(lastDay && gap === 2 && freezes > 0)
  const nextFreezes = freezeConsumed ? freezes - 1 : freezes

  const nextStreak =
    lastDay && isConsecutiveDay(lastDay, dateKey)
      ? streak + 1
      : dateKey === lastDay
        ? streak
        : freezeConsumed
          ? streak + 1
          : 1
  const streakBroken = Boolean(lastDay && dateKey !== lastDay && !freezeConsumed && nextStreak === 1)

  const base = 100
  const bonus = nextStreak >= 2 ? 50 + Math.max(0, nextStreak - 2) * 25 : 0
  const nominal = base + bonus
  const totalDelta = Math.max(0, Math.round(nominal * dailyMultiplier))
  const nextTotal = total + totalDelta

  setInt(SCORE_KEY, nextTotal)
  setInt(STREAK_KEY, nextStreak)
  if (freezeConsumed) setInt(STREAK_FREEZE_KEY, freezes - 1)
  localStorage.setItem(SCORE_UPDATED_AT_KEY, String(Date.now()))
  if (streakBroken && streak > 1) {
    writeRestoreCandidate({
      streak,
      restoreTo: streak + 1,
      lastDay: lastDay ?? '',
      brokenDateKey: dateKey,
      brokenAt: Date.now(),
      missedDays: Math.max(1, (gap ?? 2) - 1),
    })
  } else if (!streakBroken && nextStreak > 1) {
    writeRestoreCandidate(null)
  }
  localStorage.setItem(LAST_DAY_KEY, dateKey)
  notifyLocalDataChanged()

  const hint = buildAwardHint(logsTodayBefore, dailyMultiplier, totalDelta, bonus, nextStreak, freezeConsumed)

  return {
    base,
    bonus,
    dailyMultiplier,
    logsTodayBefore,
    totalDelta,
    nextTotal,
    nextStreak,
    previousStreak: streak,
    previousStreakFreezes: freezes,
    nextStreakFreezes: nextFreezes,
    streakBroken,
    freezeConsumed,
    hint,
  }
}

export function getScoreSnapshot() {
  return {
    total: getInt(SCORE_KEY, 0),
    streak: getInt(STREAK_KEY, 0),
    lastDay: localStorage.getItem(LAST_DAY_KEY),
    streakFreezes: getInt(STREAK_FREEZE_KEY, 0),
    streakRestore: readRestoreCandidate(),
  }
}

export type ScoreSyncPayload = {
  total?: number
  streak?: number
  lastDay?: string | null
  streakFreezes?: number
  streakRestore?: StreakRestoreCandidate | null
}

/** Apply a score document from cloud sync or recovery. */
export function applyScoreSnapshotFromSync(payload: ScoreSyncPayload, updatedAt: number) {
  if (typeof payload.total === 'number') {
    setInt(SCORE_KEY, payload.total)
  }

  if (typeof payload.streak === 'number') {
    setInt(STREAK_KEY, payload.streak)
  }

  if (payload.lastDay === null) {
    // We intentionally do not remove the last day if it's null on the remote,
    // to avoid deleting legitimate local history on a sync overwrite.
    // (If it was truly a full wipe, the wipe logic handles dropping the DB).
  } else if (typeof payload.lastDay === 'string' && payload.lastDay) {
    const currentLastDay = localStorage.getItem(LAST_DAY_KEY)
    // Only apply remote lastDay if it's chronologically newer or equal to the local lastDay
    // This prevents older sync data from making the app think there's a day gap on the next log.
    if (!currentLastDay || payload.lastDay >= currentLastDay) {
      localStorage.setItem(LAST_DAY_KEY, payload.lastDay)
    }
  }

  if (typeof payload.streakFreezes === 'number') {
    setStreakFreezesForSync(payload.streakFreezes)
  }

  if (payload.streakRestore === null || typeof payload.streakRestore === 'object') {
    setStreakRestoreForSync(payload.streakRestore ?? null)
  }

  localStorage.setItem(SCORE_UPDATED_AT_KEY, String(Math.trunc(updatedAt)))
  notifyLocalDataChanged()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mentell:score-changed'))
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
  localStorage.setItem(SCORE_UPDATED_AT_KEY, String(Date.now()))
  notifyLocalDataChanged()
  return { ok: true, spent: clean, nextTotal }
}

export function setStreakFreezesForSync(count: number) {
  const clean = Math.min(STREAK_FREEZE_MAX, Math.max(0, Math.trunc(Number(count))))
  if (Number.isFinite(clean)) localStorage.setItem(STREAK_FREEZE_KEY, String(clean))
}

export function setStreakRestoreForSync(candidate: StreakRestoreCandidate | null) {
  writeRestoreCandidate(sanitizeRestoreCandidate(candidate))
}

export function buyStreakFreeze(): BuyStreakFreezeResult {
  if (!isPointsEnabled()) {
    return {
      ok: false,
      spent: 0,
      nextTotal: getInt(SCORE_KEY, 0),
      nextFreezes: getInt(STREAK_FREEZE_KEY, 0),
      reason: 'invalid',
    }
  }
  const currentFreezes = getInt(STREAK_FREEZE_KEY, 0)
  if (currentFreezes >= STREAK_FREEZE_MAX) {
    return {
      ok: false,
      spent: 0,
      nextTotal: getInt(SCORE_KEY, 0),
      nextFreezes: currentFreezes,
      reason: 'max',
    }
  }
  const spend = spendScore(STREAK_FREEZE_COST)
  if (!spend.ok) {
    return {
      ok: false,
      spent: 0,
      nextTotal: spend.nextTotal,
      nextFreezes: currentFreezes,
      reason: spend.reason,
    }
  }
  const nextFreezes = currentFreezes + 1
  setInt(STREAK_FREEZE_KEY, nextFreezes)
  localStorage.setItem(SCORE_UPDATED_AT_KEY, String(Date.now()))
  notifyLocalDataChanged()
  return { ok: true, spent: STREAK_FREEZE_COST, nextTotal: spend.nextTotal, nextFreezes }
}

export function buyStreakRestore(): BuyStreakRestoreResult {
  if (!isPointsEnabled()) {
    return { ok: false, spent: 0, nextTotal: getInt(SCORE_KEY, 0), reason: 'invalid' }
  }
  const candidate = readRestoreCandidate()
  if (!candidate) {
    return { ok: false, spent: 0, nextTotal: getInt(SCORE_KEY, 0), reason: 'none' }
  }
  const spend = spendScore(STREAK_RESTORE_COST)
  if (!spend.ok) {
    return { ok: false, spent: 0, nextTotal: spend.nextTotal, reason: spend.reason }
  }
  setInt(STREAK_KEY, candidate.restoreTo)
  writeRestoreCandidate(null)
  localStorage.setItem(SCORE_UPDATED_AT_KEY, String(Date.now()))
  notifyLocalDataChanged()
  return {
    ok: true,
    spent: STREAK_RESTORE_COST,
    nextTotal: spend.nextTotal,
    restoredStreak: candidate.restoreTo,
  }
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
  localStorage.setItem(SCORE_UPDATED_AT_KEY, String(Date.now()))
  notifyLocalDataChanged()

  const hint =
    kind === 'yearly'
      ? `Yearly package bonus (+${delta})`
      : kind === 'monthly'
        ? `Monthly package bonus (+${delta})`
        : `Weekly package bonus (+${delta})`

  return { delta, nextTotal, hint }
}

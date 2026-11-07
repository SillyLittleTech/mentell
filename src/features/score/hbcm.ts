/**
 * HBCM — Heat-Based Consistency Multiplier (0–5 internal, display rounds up).
 * @see docs/SCORING_SEMANTICS.md
 */

import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { stripDateKey } from "../../shared/dates";

/** Constant `HBCM_MIN` used by the app. */
export const HBCM_MIN = 0;
/** Constant `HBCM_MAX` used by the app. */
export const HBCM_MAX = 5;
/** Constant `HBCM_COMPLETE_DELTA` used by the app. */
export const HBCM_COMPLETE_DELTA = 1;
/** Constant `HBCM_MISS_DELTA` used by the app. */
export const HBCM_MISS_DELTA = 0.5;

/** `clampHbcm` — see module for behavior. */
export function clampHbcm(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  return Math.min(HBCM_MAX, Math.max(HBCM_MIN, raw));
}

/** Display value: round up for user leeway */
export function hbcmDisplayValue(raw: number): number {
  return Math.min(
    HBCM_MAX,
    Math.max(HBCM_MIN, Math.ceil(clampHbcm(raw) - 1e-9)),
  );
}

function parseDateKey(key: string) {
  return parseISO(stripDateKey(key));
}

/** `calendarDayGap` — see module for behavior. */
export function calendarDayGap(
  prevKey: string,
  nextKey: string,
): number | null {
  try {
    return differenceInCalendarDays(
      parseDateKey(nextKey),
      parseDateKey(prevKey),
    );
  } catch {
    return null;
  }
}

/** `nextCalendarDayKey` — see module for behavior. */
export function nextCalendarDayKey(dateKey: string): string {
  return format(addDays(parseDateKey(dateKey), 1), "yyyy-MM-dd");
}

/**
 * Apply missed-day penalties for empty calendar days between lastProcessedDay and today (exclusive of today’s handling by caller).
 * lastProcessedDay: last YYYY-MM-DD we already applied HBCM accounting for; null if never.
 */
/** `missedDayPenalties` — see module for behavior. */
export function missedDayPenalties(
  lastProcessedDay: string | null,
  todayKey: string,
  hasFirstCompletion: boolean,
): { penalties: number; newLastMissProcessed: string | null } {
  if (!hasFirstCompletion || !lastProcessedDay) {
    return { penalties: 0, newLastMissProcessed: lastProcessedDay };
  }
  const gap = calendarDayGap(lastProcessedDay, todayKey);
  if (gap === null || gap <= 1) {
    return { penalties: 0, newLastMissProcessed: lastProcessedDay };
  }
  // Days strictly between lastProcessed and today are "missed" if we didn't log — caller passes gap already filtered by completion set
  const missedCount = gap - 1;
  return {
    penalties: missedCount * HBCM_MISS_DELTA,
    newLastMissProcessed: lastProcessedDay,
  };
}

/** `applyHbcmCompletion` — see module for behavior. */
export function applyHbcmCompletion(raw: number): number {
  return clampHbcm(raw + HBCM_COMPLETE_DELTA);
}

/** `applyHbcmMisses` — see module for behavior. */
export function applyHbcmMisses(raw: number, missedCount: number): number {
  if (missedCount <= 0) return clampHbcm(raw);
  return clampHbcm(raw - missedCount * HBCM_MISS_DELTA);
}

/** Map legacy integer streak to initial HBCM raw (gentle migration). */
export function migrateStreakToHbcmRaw(streak: number): number {
  const s = Math.max(0, Math.trunc(streak));
  return clampHbcm(s * 0.85);
}

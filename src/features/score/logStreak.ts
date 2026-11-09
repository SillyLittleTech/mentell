import { calendarDayGap } from "./hbcm";

/** Consecutive logged calendar days (hidden); unrelated to heat 0–5. */
export function nextLogStreakOnFirstDailyLog(
  current: number,
  lastScoreDay: string | null,
  dateKey: string,
): number {
  const safe = Math.max(0, Math.trunc(current));
  if (!lastScoreDay) return Math.max(1, safe);
  if (lastScoreDay === dateKey) return safe;
  const gap = calendarDayGap(lastScoreDay, dateKey);
  if (gap === 1) return safe + 1;
  return 1;
}

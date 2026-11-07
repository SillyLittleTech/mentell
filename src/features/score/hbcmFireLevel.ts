import {
  STREAK_FIRE_MAX_LEVEL,
  getStreakFlameCount,
  streakFlickerDuration,
} from "./streakFireLevel";

/** Map 0–5 consistency heat display to legacy streak fire tiers (0–6). */
export function getHbcmFireLevel(hbcmDisplay: number): number {
  const d = Math.min(5, Math.max(0, Math.round(hbcmDisplay)));
  if (d <= 0) return 0;
  if (d === 1) return 1;
  if (d === 2) return 2;
  if (d === 3) return 3;
  if (d === 4) return 5;
  return STREAK_FIRE_MAX_LEVEL;
}

export { getStreakFlameCount, streakFlickerDuration };

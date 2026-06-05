export const STREAK_FIRE_MAX_LEVEL = 6

/** Visual fire tier for streak display (0 = none, 6 = inferno). */
export function getStreakFireLevel(streak: number): number {
  if (streak <= 1) return 0
  if (streak === 2) return 1
  if (streak <= 4) return 2
  if (streak <= 6) return 3
  if (streak <= 10) return 4
  if (streak <= 20) return 5
  return 6
}

/** Number of flame emojis to show at corners (0–3). */
export function getStreakFlameCount(level: number): number {
  if (level <= 3) return 0
  if (level === 4) return 1
  if (level === 5) return 2
  return 3
}

/** Flicker animation duration in seconds; faster = hotter. */
export function streakFlickerDuration(level: number): number {
  if (level <= 4) return 0.85
  if (level === 5) return 0.65
  return 0.45
}

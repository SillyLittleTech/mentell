import { describe, it, expect } from 'vitest'
import {
  getStreakFireLevel,
  getStreakFlameCount,
  streakFlickerDuration,
  STREAK_FIRE_MAX_LEVEL,
} from './streakFireLevel'

describe('streakFireLevel', () => {
  describe('getStreakFireLevel', () => {
    it('returns 0 for streaks <= 1', () => {
      expect(getStreakFireLevel(-1)).toBe(0)
      expect(getStreakFireLevel(0)).toBe(0)
      expect(getStreakFireLevel(1)).toBe(0)
    })

    it('returns correct levels for specific streak ranges', () => {
      expect(getStreakFireLevel(2)).toBe(1)
      expect(getStreakFireLevel(3)).toBe(2)
      expect(getStreakFireLevel(4)).toBe(2)
      expect(getStreakFireLevel(5)).toBe(3)
      expect(getStreakFireLevel(6)).toBe(3)
      expect(getStreakFireLevel(7)).toBe(4)
      expect(getStreakFireLevel(10)).toBe(4)
      expect(getStreakFireLevel(11)).toBe(5)
      expect(getStreakFireLevel(20)).toBe(5)
    })

    it('returns MAX_LEVEL for streaks > 20', () => {
      expect(getStreakFireLevel(21)).toBe(STREAK_FIRE_MAX_LEVEL)
      expect(getStreakFireLevel(100)).toBe(STREAK_FIRE_MAX_LEVEL)
    })
  })

  describe('getStreakFlameCount', () => {
    it('returns 0 for levels <= 3', () => {
      expect(getStreakFlameCount(0)).toBe(0)
      expect(getStreakFlameCount(1)).toBe(0)
      expect(getStreakFlameCount(2)).toBe(0)
      expect(getStreakFlameCount(3)).toBe(0)
    })

    it('returns correct flame count for higher levels', () => {
      expect(getStreakFlameCount(4)).toBe(1)
      expect(getStreakFlameCount(5)).toBe(2)
      expect(getStreakFlameCount(6)).toBe(3)
      expect(getStreakFlameCount(10)).toBe(3) // Handles out of bounds gracefully
    })
  })

  describe('streakFlickerDuration', () => {
    it('returns slower duration for levels <= 4', () => {
      expect(streakFlickerDuration(0)).toBe(0.85)
      expect(streakFlickerDuration(4)).toBe(0.85)
    })

    it('returns faster duration for level 5', () => {
      expect(streakFlickerDuration(5)).toBe(0.65)
    })

    it('returns fastest duration for levels > 5', () => {
      expect(streakFlickerDuration(6)).toBe(0.45)
      expect(streakFlickerDuration(10)).toBe(0.45)
    })
  })
})

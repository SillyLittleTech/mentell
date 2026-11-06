import { describe, it, expect } from 'vitest'
import {
  applyHbcmCompletion,
  applyHbcmMisses,
  calendarDayGap,
  clampHbcm,
  hbcmDisplayValue,
  migrateStreakToHbcmRaw,
  nextCalendarDayKey,
} from './hbcm'

describe('hbcm', () => {
  it('clamps raw values to 0–5', () => {
    expect(clampHbcm(-1)).toBe(0)
    expect(clampHbcm(6)).toBe(5)
    expect(clampHbcm(2.3)).toBe(2.3)
  })

  it('displays rounded up with leeway', () => {
    expect(hbcmDisplayValue(2.001)).toBe(3)
    expect(hbcmDisplayValue(2)).toBe(2)
    expect(hbcmDisplayValue(0)).toBe(0)
  })

  it('applies completion +1 and misses in half steps', () => {
    expect(applyHbcmCompletion(2)).toBe(3)
    expect(applyHbcmMisses(3, 2)).toBe(2)
    expect(applyHbcmMisses(0.25, 1)).toBe(0)
  })

  it('computes calendar gap between date keys', () => {
    expect(calendarDayGap('2026-01-01', '2026-01-03')).toBe(2)
    expect(nextCalendarDayKey('2026-01-01')).toBe('2026-01-02')
  })

  it('migrates legacy streak gently into raw HBCM', () => {
    expect(migrateStreakToHbcmRaw(4)).toBeCloseTo(3.4)
  })
})

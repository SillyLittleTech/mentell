import { describe, it, expect } from 'vitest'
import { weekKeyForDateKey, dateFromWeekKey, previousWeekKey } from './weeklyStats'
import { format } from 'date-fns'

describe('weeklyStats ISO week calculations', () => {
  describe('weekKeyForDateKey', () => {
    it('formats normal dates correctly', () => {
      expect(weekKeyForDateKey('2023-01-10')).toBe('2023-W02') // Jan 10 is a Tuesday
      expect(weekKeyForDateKey('2024-02-29')).toBe('2024-W09') // Leap year
      expect(weekKeyForDateKey('~2024-05-15')).toBe('2024-W20') // Handles bulk/approximate dates
    })

    it('formats tricky end-of-year/start-of-year dates correctly', () => {
      // 2023-01-01 is Sunday, so it belongs to the last week of 2022
      expect(weekKeyForDateKey('2023-01-01')).toBe('2022-W52')

      // 2024-12-31 is Tuesday, so it belongs to the first week of 2025
      expect(weekKeyForDateKey('2024-12-31')).toBe('2025-W01')

      // 2021-01-01 is Friday, belongs to 2020-W53
      expect(weekKeyForDateKey('2021-01-01')).toBe('2020-W53')
    })
  })

  describe('dateFromWeekKey', () => {
    it('parses valid week keys to correct Monday Date', () => {
      const d1 = dateFromWeekKey('2023-W02')
      expect(d1).not.toBeNull()
      expect(format(d1!, 'yyyy-MM-dd')).toBe('2023-01-09') // Monday of week 2
      expect(d1!.getDay()).toBe(1) // 1 = Monday

      const d2 = dateFromWeekKey('2024-W09')
      expect(d2).not.toBeNull()
      expect(format(d2!, 'yyyy-MM-dd')).toBe('2024-02-26')
    })

    it('parses tricky week keys correctly', () => {
      // 2022-W52 should be 2022-12-26
      const d1 = dateFromWeekKey('2022-W52')
      expect(d1).not.toBeNull()
      expect(format(d1!, 'yyyy-MM-dd')).toBe('2022-12-26')

      // 2025-W01 should be 2024-12-30
      const d2 = dateFromWeekKey('2025-W01')
      expect(d2).not.toBeNull()
      expect(format(d2!, 'yyyy-MM-dd')).toBe('2024-12-30')
    })

    it('returns null for invalid formats', () => {
      expect(dateFromWeekKey('')).toBeNull()
      expect(dateFromWeekKey('2024')).toBeNull()
      expect(dateFromWeekKey('202-W01')).toBeNull()
      expect(dateFromWeekKey('2024-W0')).toBeNull()
      expect(dateFromWeekKey('invalid')).toBeNull()
    })

    it('returns null for out of range weeks', () => {
      expect(dateFromWeekKey('2024-W00')).toBeNull()
      expect(dateFromWeekKey('2024-W54')).toBeNull()
    })
  })

  describe('previousWeekKey', () => {
    it('returns the previous week key correctly', () => {
      expect(previousWeekKey('2024-W09')).toBe('2024-W08')
      expect(previousWeekKey('2023-W02')).toBe('2023-W01')
    })

    it('handles year boundaries correctly', () => {
      expect(previousWeekKey('2024-W01')).toBe('2023-W52') // 2023 had 52 weeks
      expect(previousWeekKey('2025-W01')).toBe('2024-W52') // 2024 had 52 weeks
      expect(previousWeekKey('2021-W01')).toBe('2020-W53') // 2020 had 53 weeks
    })

    it('returns null for invalid week keys', () => {
      expect(previousWeekKey('invalid')).toBeNull()
    })
  })
})

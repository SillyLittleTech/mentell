import { describe, expect, it } from 'vitest'
import { inDeliveryWindow, localTimeParts } from './pushDelivery'

const TZ = 'America/New_York'

/** Monday 2026-08-17 09:00 EDT = 13:00 UTC */
const mondayNineAm = new Date('2026-08-17T13:00:00.000Z')

describe('localTimeParts', () => {
  it('uses 0–23 hours (not 24 at midnight)', () => {
    const midnight = new Date('2026-08-17T04:00:00.000Z')
    const parts = localTimeParts(midnight, TZ)
    expect(parts.weekday).toBe(1)
    expect(parts.hour).toBe(0)
    expect(parts.minute).toBe(0)
  })
})

describe('inDeliveryWindow', () => {
  it('opens at the configured local weekday and time', () => {
    expect(inDeliveryWindow(mondayNineAm, 1, '09:00', TZ)).toBe(true)
  })

  it('stays closed a minute before delivery time', () => {
    const before = new Date('2026-08-17T12:59:00.000Z')
    expect(inDeliveryWindow(before, 1, '09:00', TZ)).toBe(false)
  })

  it('stays open after the old 15-minute cron slot so a jittered cron still delivers', () => {
    const twentyLater = new Date('2026-08-17T13:20:00.000Z')
    expect(inDeliveryWindow(twentyLater, 1, '09:00', TZ)).toBe(true)
    const afternoon = new Date('2026-08-17T19:00:00.000Z')
    expect(inDeliveryWindow(afternoon, 1, '09:00', TZ)).toBe(true)
  })

  it('catches up later in the week if Monday crons missed', () => {
    const wednesday = new Date('2026-08-19T15:00:00.000Z')
    expect(inDeliveryWindow(wednesday, 1, '09:00', TZ)).toBe(true)
  })

  it('closes again just before the next weekly slot', () => {
    const nextMondayBefore = new Date('2026-08-24T12:59:00.000Z')
    expect(inDeliveryWindow(nextMondayBefore, 1, '09:00', TZ)).toBe(false)
  })
})

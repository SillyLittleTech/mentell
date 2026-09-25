import { describe, expect, it } from 'vitest'
import {
  NAV_ICONS,
  NAV_LETTER_ICON,
  applyReducedMotion,
  navAnimationKindForRoute,
  navMotionDurationSec,
  navMotionPlan,
  navPrimaryMaterialIcon,
} from './navIconMotion'

describe('navAnimationKindForRoute', () => {
  it('maps every main nav route to an animation kind', () => {
    expect(navAnimationKindForRoute('/')).toBe('envelope')
    expect(navAnimationKindForRoute('/week')).toBe('projector')
    expect(navAnimationKindForRoute('/notes')).toBe('notepad')
    expect(navAnimationKindForRoute('/shop')).toBe('shoppe')
    expect(navAnimationKindForRoute('/settings')).toBe('settings')
    expect(navAnimationKindForRoute('/character-lab')).toBe('character')
  })

  it('returns null for unknown routes', () => {
    expect(navAnimationKindForRoute('/privacy')).toBeNull()
  })
})

describe('navPrimaryMaterialIcon', () => {
  it('uses mail on desktop envelope and edit_square on mobile write tab', () => {
    expect(navPrimaryMaterialIcon('/', 'sidebar')).toBe(NAV_ICONS.envelopeDesktop)
    expect(navPrimaryMaterialIcon('/', 'bottom')).toBe(NAV_ICONS.envelopeMobile)
  })

  it('uses the notepad letter icon for envelope prelude animation', () => {
    expect(NAV_LETTER_ICON).toBe(NAV_ICONS.notepad)
  })
})

describe('navMotionPlan — issue #206 animation skeleton', () => {
  it('envelope: letter slides down, envelope slides up', () => {
    const plan = navMotionPlan('envelope')
    expect(plan.letter?.animate).toMatchObject({ y: 9, opacity: 0 })
    expect(plan.primary?.initial).toMatchObject({ y: -11, opacity: 0 })
    expect(plan.primary?.animate).toMatchObject({ y: 0, opacity: 1 })
    expect((plan.primary?.transition as { delay?: number }).delay).toBeGreaterThan(0)
  })

  it('projector: closed book expands then swaps to stories icon mid animation', () => {
    const plan = navMotionPlan('projector')
    expect(plan.book?.initial).toMatchObject({ scale: 0.75 })
    expect(plan.book?.animate).toMatchObject({ scale: 1.1, opacity: 0 })
    expect(plan.primary?.animate).toMatchObject({ scale: 1, opacity: 1 })
    expect(plan.swapAtRatio).toBeGreaterThan(0.4)
    expect(plan.swapAtRatio).toBeLessThan(0.55)
  })

  it('notepad: paper rises from below', () => {
    const plan = navMotionPlan('notepad')
    expect(plan.single?.initial).toMatchObject({ y: 13 })
    expect(plan.single?.animate).toMatchObject({ y: 0, opacity: 1 })
  })

  it('shoppe: slides in from the left with italic slant then settles', () => {
    const plan = navMotionPlan('shoppe')
    expect(plan.single?.initial).toMatchObject({ x: -16, skewX: -13, scale: 0.84 })
    expect(plan.single?.animate).toMatchObject({ x: 0, skewX: 0, scale: 1 })
  })

  it('settings: cog rotates into place', () => {
    const plan = navMotionPlan('settings')
    expect(plan.single?.initial).toMatchObject({ rotate: -140 })
    expect(plan.single?.animate).toMatchObject({ rotate: 0, scale: 1 })
  })

  it('character: quick horizontal shake keyframes', () => {
    const plan = navMotionPlan('character')
    expect(plan.shake?.x).toEqual([0, -3, 3, -2.5, 2.5, -1, 1, 0])
  })

  it('keeps animations quick but visible (under half a second each)', () => {
    for (const kind of [
      'envelope',
      'projector',
      'notepad',
      'shoppe',
      'settings',
      'character',
    ] as const) {
      expect(navMotionDurationSec(kind)).toBeGreaterThan(0.28)
      expect(navMotionDurationSec(kind)).toBeLessThan(0.45)
    }
  })
})

describe('applyReducedMotion', () => {
  it('zeroes transition durations when reduced motion is requested', () => {
    const plan = applyReducedMotion(navMotionPlan('shoppe'), true)
    expect(plan.durationSec).toBe(0)
    expect((plan.single?.transition as { duration?: number }).duration).toBe(0)
  })
})

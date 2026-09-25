import type { TargetAndTransition, Transition } from 'framer-motion'

export type NavAnimationKind =
  | 'envelope'
  | 'projector'
  | 'notepad'
  | 'shoppe'
  | 'settings'
  | 'character'

/** Letter icon — same Material symbol as Notepad. */
export const NAV_LETTER_ICON = 'description'

export const NAV_ICONS = {
  envelopeDesktop: 'mail',
  envelopeMobile: 'edit_square',
  projector: 'auto_stories',
  projectorBook: 'book',
  notepad: 'description',
  shoppe: 'storefront',
  settings: 'settings',
} as const

const ROUTE_ANIMATION: Record<string, NavAnimationKind> = {
  '/': 'envelope',
  '/week': 'projector',
  '/notes': 'notepad',
  '/shop': 'shoppe',
  '/settings': 'settings',
  '/character-lab': 'character',
}

export function navAnimationKindForRoute(path: string): NavAnimationKind | null {
  return ROUTE_ANIMATION[path] ?? null
}

export function navPrimaryMaterialIcon(
  path: string,
  variant: 'sidebar' | 'bottom',
): string | null {
  const kind = navAnimationKindForRoute(path)
  if (!kind || kind === 'character') return null
  if (kind === 'envelope') {
    return variant === 'sidebar' ? NAV_ICONS.envelopeDesktop : NAV_ICONS.envelopeMobile
  }
  if (kind === 'projector') return NAV_ICONS.projector
  if (kind === 'notepad') return NAV_ICONS.notepad
  if (kind === 'shoppe') return NAV_ICONS.shoppe
  if (kind === 'settings') return NAV_ICONS.settings
  return null
}

export type NavMotionPhaseSpec = {
  initial: TargetAndTransition
  animate: TargetAndTransition
  transition: Transition
}

export type NavMotionPlan = {
  kind: NavAnimationKind
  /** Total play time in seconds (before reduced-motion zeroing). */
  durationSec: number
  letter?: NavMotionPhaseSpec
  primary?: NavMotionPhaseSpec
  book?: NavMotionPhaseSpec
  swapAtRatio?: number
  single?: NavMotionPhaseSpec
  shake?: TargetAndTransition
}

/** Snappy ease-out — keeps motion visible without feeling sluggish after click. */
const quickEase: Transition = { type: 'tween', ease: [0.33, 1, 0.45, 1] }

export function navMotionPlan(kind: NavAnimationKind): NavMotionPlan {
  switch (kind) {
    case 'envelope':
      return {
        kind,
        durationSec: 0.3,
        letter: {
          initial: { y: 0, opacity: 1 },
          animate: { y: 8, opacity: 0 },
          transition: { ...quickEase, duration: 0.14 },
        },
        primary: {
          initial: { y: -10, opacity: 0 },
          animate: { y: 0, opacity: 1 },
          transition: { ...quickEase, duration: 0.16, delay: 0.08 },
        },
      }
    case 'projector':
      return {
        kind,
        durationSec: 0.3,
        swapAtRatio: 0.45,
        book: {
          initial: { scale: 0.78, opacity: 1 },
          animate: { scale: 1.08, opacity: 0 },
          transition: { ...quickEase, duration: 0.15 },
        },
        primary: {
          initial: { scale: 0.78, opacity: 0 },
          animate: { scale: 1, opacity: 1 },
          transition: { ...quickEase, duration: 0.17, delay: 0.1 },
        },
      }
    case 'notepad':
      return {
        kind,
        durationSec: 0.26,
        single: {
          initial: { y: 12, opacity: 0.5 },
          animate: { y: 0, opacity: 1 },
          transition: { ...quickEase, duration: 0.24 },
        },
      }
    case 'shoppe':
      return {
        kind,
        durationSec: 0.28,
        single: {
          initial: { x: -14, skewX: -12, scale: 0.86, opacity: 0.9 },
          animate: { x: 0, skewX: 0, scale: 1, opacity: 1 },
          transition: { ...quickEase, duration: 0.26 },
        },
      }
    case 'settings':
      return {
        kind,
        durationSec: 0.26,
        single: {
          initial: { rotate: -120, scale: 0.92 },
          animate: { rotate: 0, scale: 1 },
          transition: { ...quickEase, duration: 0.24 },
        },
      }
    case 'character':
      return {
        kind,
        durationSec: 0.22,
        shake: { x: [0, -3, 3, -2, 2, 0] },
      }
    default: {
      const _exhaustive: never = kind
      return _exhaustive
    }
  }
}

export function navMotionDurationSec(kind: NavAnimationKind): number {
  return navMotionPlan(kind).durationSec
}

/** Scale transition durations to 0 when motion is reduced. */
export function applyReducedMotion(plan: NavMotionPlan, reduced: boolean): NavMotionPlan {
  if (!reduced) return plan
  const zero = (t: Transition | undefined): Transition => ({
    ...(t ?? {}),
    duration: 0,
    delay: 0,
  })
  return {
    ...plan,
    durationSec: 0,
    letter: plan.letter
      ? { ...plan.letter, transition: zero(plan.letter.transition) }
      : undefined,
    primary: plan.primary
      ? { ...plan.primary, transition: zero(plan.primary.transition) }
      : undefined,
    book: plan.book ? { ...plan.book, transition: zero(plan.book.transition) } : undefined,
    single: plan.single
      ? { ...plan.single, transition: zero(plan.single.transition) }
      : undefined,
  }
}

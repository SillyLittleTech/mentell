import { isDebugMode, getSlowMo } from '../debug/debugFlags'
import { loadAppSettings } from '../settings/appSettings'

export function systemPrefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
}

export function shouldReduceMotion() {
  const settings = loadAppSettings()
  return settings.reducedMotion || systemPrefersReducedMotion()
}

/** Duration multiplier; 0 when motion should be reduced. */
export function motionDuration(base: number) {
  if (shouldReduceMotion()) return 0
  if (isDebugMode()) return base * getSlowMo()
  return base
}

export function useMotionPrefs() {
  return {
    reduced: shouldReduceMotion(),
    duration: motionDuration,
  }
}

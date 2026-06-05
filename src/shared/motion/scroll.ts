import { shouldReduceMotion } from './useMotionPrefs'

function scrollBehavior() {
  return shouldReduceMotion() ? 'auto' : 'smooth'
}

export function scrollToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: scrollBehavior() })
}

export function scrollToElementId(id: string) {
  const el = document.getElementById(id.replace(/^#/, ''))
  el?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' })
}

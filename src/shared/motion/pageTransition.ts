import type { TargetAndTransition, Transition } from 'framer-motion'
import { motionDuration, shouldReduceMotion } from './useMotionPrefs'

const enter: TargetAndTransition = { opacity: 0, x: 36, y: 8, scale: 0.99, rotate: 1.1, skewY: -1.2 }
const visible: TargetAndTransition = { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0, skewY: 0 }
const leave: TargetAndTransition = { opacity: 0, x: -44, y: -4, scale: 0.995, rotate: -1.2, skewY: 1.4 }

export function pageTransitionProps() {
  const reduced = shouldReduceMotion()
  const duration = motionDuration(0.28) || 0
  const transition: Transition = { duration, ease: [0.22, 0.8, 0.2, 1] }

  if (reduced) {
    return {
      initial: false as const,
      animate: visible,
      exit: visible,
      transition: { duration: 0 },
    }
  }

  return {
    initial: enter,
    animate: visible,
    exit: leave,
    transition,
  }
}

import type { TargetAndTransition, Transition } from 'framer-motion'
import { motionDuration, shouldReduceMotion } from './useMotionPrefs'

const enter: TargetAndTransition = { opacity: 0, y: 12, scale: 0.99 }
const visible: TargetAndTransition = { opacity: 1, y: 0, scale: 1 }
const leave: TargetAndTransition = { opacity: 0, y: -6, scale: 0.995 }

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

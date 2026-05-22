import type { TargetAndTransition, Transition } from 'framer-motion'
import { motionDuration, shouldReduceMotion } from './useMotionPrefs'

const enter: TargetAndTransition = { opacity: 0, y: 8 }
const visible: TargetAndTransition = { opacity: 1, y: 0 }
const leave: TargetAndTransition = { opacity: 0, y: -4 }

export function pageTransitionProps() {
  const reduced = shouldReduceMotion()
  const duration = motionDuration(0.22) || 0
  const transition: Transition = { duration, ease: [0.25, 0.1, 0.25, 1] }

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

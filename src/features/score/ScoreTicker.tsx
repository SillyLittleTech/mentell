import { AnimatePresence, motion } from 'framer-motion'
import { useLayoutEffect, useRef, useState } from 'react'
import { motionDuration } from '../../shared/motion/useMotionPrefs'
import { StreakFlame } from './StreakFlame'
import { shouldReduceMotion } from '../../shared/motion/useMotionPrefs'
import { StreakFreezeBadge } from './StreakFreezeBadge'
import { MaterialIcon } from '../../components/MaterialIcon'

export function ScoreTicker({
  total,
  streak,
  streakFreezes,
  hint,
  streakOutcome,
}: {
  total: number
  streak: number
  streakFreezes?: number
  hint: string | null
  streakOutcome?:
    | { kind: 'break'; key: number; from: number }
    | { kind: 'freeze'; key: number; previousFreezes: number; nextFreezes: number }
    | null
}) {
  const reduced = shouldReduceMotion()
  const streakPulse = Boolean(hint?.toLowerCase().includes('streak'))
  const freezeAnimation = streakOutcome?.kind === 'freeze' ? streakOutcome : null
  const visibleFreezes =
    freezeAnimation && !reduced ? Math.max(streakFreezes ?? 0, freezeAnimation.previousFreezes) : streakFreezes

  const prevTotalRef = useRef(total)
  const [direction, setDirection] = useState<'increase' | 'decrease'>('increase')

  useLayoutEffect(() => {
    const nextDirection = total >= prevTotalRef.current ? 'increase' : 'decrease'
    setDirection(nextDirection)
    prevTotalRef.current = total
  }, [total])

  const enterOffset = direction === 'increase' ? 14 : -14
  const exitOffset = direction === 'increase' ? -14 : 14

  return (
    <div className="flex flex-nowrap items-center justify-end gap-2">
      <motion.div
        className="rounded-2xl border border-[var(--paper-border)] px-3 py-2"
        whileHover={reduced ? undefined : { y: -1.5 }}
        transition={{ duration: motionDuration(0.16) || 0 }}
      >
        <div className="flex items-center gap-2">
          <MaterialIcon name="trophy" accent={false} className="opacity-70" size={18} />
          <div className="relative min-w-[2.8ch] text-right">
            <AnimatePresence initial={false} mode="wait">
              <motion.div
                key={total}
                className="font-mono text-lg font-bold"
                initial={
                  reduced ? false : { y: enterOffset, opacity: 0 }
                }
                animate={{ y: 0, opacity: 1 }}
                exit={reduced ? undefined : { y: exitOffset, opacity: 0 }}
                transition={{ duration: motionDuration(0.28) || 0 }}
              >
                {total}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      <motion.div
        whileHover={reduced ? undefined : { y: -1.5 }}
        transition={{ duration: motionDuration(0.16) || 0 }}
      >
        <StreakFlame
          streak={streak}
          reducedMotion={reduced}
          pulse={streakPulse}
          outcomeAnimation={streakOutcome}
        />
      </motion.div>
      {visibleFreezes !== undefined && visibleFreezes > 0 ? (
        <StreakFreezeBadge count={visibleFreezes} consumeAnimation={freezeAnimation} />
      ) : null}
    </div>
  )
}

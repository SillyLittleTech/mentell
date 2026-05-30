import { motion } from 'framer-motion'
import { motionDuration } from '../../shared/motion/useMotionPrefs'
import { StreakFlame } from './StreakFlame'
import { shouldReduceMotion } from '../../shared/motion/useMotionPrefs'

export function ScoreTicker({
  total,
  streak,
  streakFreezes,
  hint,
}: {
  total: number
  streak: number
  streakFreezes?: number
  hint: string | null
}) {
  const reduced = shouldReduceMotion()
  const streakPulse = Boolean(hint?.toLowerCase().includes('streak'))

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="rounded-2xl border border-[var(--paper-border)] px-3 py-2">
        <div className="font-mono text-[11px] uppercase opacity-70">score</div>
        <motion.div
          key={total}
          className="font-mono text-lg font-bold"
          initial={reduced ? false : { scale: 1 }}
          animate={reduced ? {} : { scale: [1, 1.06, 1] }}
          transition={{ duration: motionDuration(0.35) || 0 }}
        >
          {total}
        </motion.div>
      </div>

      <StreakFlame streak={streak} reducedMotion={reduced} pulse={streakPulse} />
      {streakFreezes !== undefined && streakFreezes > 0 ? (
        <div className="rounded-2xl border border-[var(--paper-border)] px-3 py-2">
          <div className="font-mono text-[11px] uppercase opacity-70">freezes</div>
          <div className="font-mono text-lg font-bold">{streakFreezes}</div>
        </div>
      ) : null}
    </div>
  )
}

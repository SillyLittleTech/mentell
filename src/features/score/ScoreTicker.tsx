import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { motionDuration } from '../../shared/motion/useMotionPrefs'
import { StreakFlame } from './StreakFlame'
import { shouldReduceMotion } from '../../shared/motion/useMotionPrefs'

export function ScoreTicker({
  total,
  streak,
  incomingDelta,
  hint,
  onDone,
}: {
  total: number
  streak: number
  incomingDelta: number | null
  hint: string | null
  onDone: () => void
}) {
  const [displayTotal, setDisplayTotal] = useState(total)
  const [animating, setAnimating] = useState(false)
  const hasAnimated = useRef(false)
  const reduced = shouldReduceMotion()
  const streakPulse = Boolean(hint?.toLowerCase().includes('streak'))

  useEffect(() => {
    if (incomingDelta === null || incomingDelta <= 0 || hasAnimated.current) return
    hasAnimated.current = true
    if (reduced) {
      setDisplayTotal(total)
      onDone()
      return
    }

    setAnimating(true)
    const start = performance.now()
    const from = Math.max(0, total - incomingDelta)
    const durationMs = motionDuration(820) || 1
    let raf = 0

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplayTotal(Math.round(from + incomingDelta * eased))
      if (t < 1) {
        raf = requestAnimationFrame(tick)
        return
      }
      window.setTimeout(() => {
        setAnimating(false)
        onDone()
      }, motionDuration(240) || 0)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [incomingDelta, onDone, total, reduced])

  useEffect(() => {
    if (incomingDelta === null) hasAnimated.current = false
  }, [incomingDelta])

  const scoreAnimDuration = motionDuration(0.35) || 0

  return (
    <div className="flex flex-wrap items-center gap-2">
      <motion.div
        className="rounded-2xl border border-[var(--paper-border)] px-3 py-2"
        animate={animating ? { backgroundColor: 'rgba(42,155,88,0.22)' } : { backgroundColor: 'transparent' }}
        transition={{ duration: scoreAnimDuration }}
      >
        <div className="font-mono text-[11px] uppercase opacity-70">score</div>
        <div className="font-mono text-lg font-bold">{incomingDelta === null ? total : displayTotal}</div>
      </motion.div>

      <StreakFlame streak={streak} reducedMotion={reduced} pulse={streakPulse} />

      <AnimatePresence>
        {incomingDelta !== null ? (
          <motion.div
            key={incomingDelta}
            className="rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-sm font-semibold"
            style={{ color: 'var(--success)' }}
            initial={reduced ? false : { x: 24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reduced ? undefined : { x: -18, opacity: 0 }}
            transition={{ duration: motionDuration(0.32) || 0 }}
          >
            +{incomingDelta}
            {hint ? <div className="ink-muted text-xs">{hint}</div> : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

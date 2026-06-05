import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { motionDuration, shouldReduceMotion } from '../../shared/motion/useMotionPrefs'

export function ScoreBurst({
  delta,
  totalAfter,
  hint,
  onDone,
}: {
  delta: number
  totalAfter: number
  hint: string | null
  onDone: () => void
}) {
  const reduced = shouldReduceMotion()
  const totalBefore = totalAfter - delta
  const [displayTotal, setDisplayTotal] = useState(reduced ? totalAfter : totalBefore)
  const [displayDelta, setDisplayDelta] = useState(reduced ? Math.abs(delta) : 0)
  const doneRef = useRef(false)

  const isGain = delta > 0
  const sign = isGain ? '+' : '−'

  useEffect(() => {
    doneRef.current = false
    if (reduced) {
      setDisplayTotal(totalAfter)
      setDisplayDelta(Math.abs(delta))
      const t = window.setTimeout(onDone, 400)
      return () => clearTimeout(t)
    }

    setDisplayTotal(totalBefore)
    setDisplayDelta(0)

    const countDuration = motionDuration(820) || 50
    const holdDuration = motionDuration(600) || 50
    const exitDuration = motionDuration(400) || 50

    let raf = 0
    const start = performance.now()

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / countDuration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplayTotal(Math.round(totalBefore + delta * eased))
      setDisplayDelta(Math.round(Math.abs(delta) * eased))
      if (t < 1) {
        raf = requestAnimationFrame(tick)
        return
      }
      window.setTimeout(() => {
        if (doneRef.current) return
        doneRef.current = true
        onDone()
      }, holdDuration + exitDuration)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [delta, onDone, reduced, totalAfter, totalBefore])

  const deltaColor = isGain ? 'var(--success)' : 'var(--danger)'

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: motionDuration(0.25) || 0.01 }}
    >
      <div
        className="absolute inset-0 bg-black/12"
        aria-hidden
      />
      <motion.div
        className="relative"
        initial={reduced ? false : { opacity: 0, y: 24, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduced ? undefined : { opacity: 0, y: -40, scale: 0.96 }}
        transition={{ duration: motionDuration(0.4) || 0.01, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <motion.div
          className="paper rounded-3xl px-8 py-6 text-center shadow-lg"
          animate={reduced ? {} : { rotate: [-1.5, 1.5, -0.5, 0.5, 0] }}
          transition={{ duration: motionDuration(0.7) || 0.01 }}
        >
          {hint ? <div className="ink-muted mb-3 max-w-xs text-sm">{hint}</div> : null}
          <div className="font-mono text-[11px] uppercase tracking-wide opacity-70">score</div>
          <div className="font-mono text-5xl font-black tabular-nums">{displayTotal}</div>
          <div
            className="mt-2 font-mono text-3xl font-bold tabular-nums"
            style={{ color: deltaColor }}
          >
            {sign}
            {displayDelta}
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

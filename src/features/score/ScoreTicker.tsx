import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

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

  useEffect(() => {
    if (incomingDelta === null || incomingDelta <= 0 || hasAnimated.current) return
    hasAnimated.current = true
    setAnimating(true)
    const start = performance.now()
    const from = Math.max(0, total - incomingDelta)
    const durationMs = 820
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
      }, 240)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [incomingDelta, onDone, total])

  useEffect(() => {
    if (incomingDelta === null) hasAnimated.current = false
  }, [incomingDelta])

  return (
    <div className="flex flex-wrap items-center gap-2">
      <motion.div
        className="rounded-2xl border border-[var(--paper-border)] px-3 py-2"
        animate={animating ? { backgroundColor: 'rgba(42,155,88,0.22)' } : { backgroundColor: 'transparent' }}
        transition={{ duration: 0.35 }}
      >
        <div className="font-mono text-[11px] uppercase opacity-70">score</div>
        <div className="font-mono text-lg font-bold">{incomingDelta === null ? total : displayTotal}</div>
      </motion.div>

      <div className="rounded-2xl border border-[var(--paper-border)] px-3 py-2">
        <div className="font-mono text-[11px] uppercase opacity-70">streak</div>
        <div className="font-mono text-lg font-bold">{streak}</div>
      </div>

      <AnimatePresence>
        {incomingDelta !== null ? (
          <motion.div
            key={incomingDelta}
            className="rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-sm font-semibold"
            style={{ color: 'var(--success)' }}
            initial={{ x: 24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -18, opacity: 0 }}
            transition={{ duration: 0.32 }}
          >
            +{incomingDelta}
            {hint ? <div className="ink-muted text-xs">{hint}</div> : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

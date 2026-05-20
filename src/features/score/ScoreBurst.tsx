import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

export function ScoreBurst({
  delta,
  hint,
  onDone,
}: {
  delta: number
  hint: string | null
  onDone: () => void
}) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const durationMs = 900

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(delta * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [delta])

  return (
    <motion.div
      className="pointer-events-none fixed left-1/2 top-24 z-50 -translate-x-1/2"
      initial={{ opacity: 0, y: 18, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -70, scale: 0.96 }}
      transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
      onAnimationComplete={() => {
        // Let the float-off finish before closing.
        setTimeout(onDone, 900)
      }}
    >
      <motion.div
        className="paper rounded-3xl px-6 py-4 text-center"
        animate={{ rotate: [-2, 2, -1, 1, 0] }}
        transition={{ duration: 0.8 }}
      >
        {hint ? <div className="ink-muted mb-1 text-sm">{hint}</div> : null}
        <div className="font-mono text-4xl font-bold" style={{ color: 'var(--success)' }}>
          +<span>{display}</span>
        </div>
      </motion.div>
      <motion.div
        className="pointer-events-none absolute left-1/2 top-full h-6 w-6 -translate-x-1/2 rounded-full"
        style={{ background: 'rgba(42,155,88,0.25)' }}
        animate={{ scale: [0.8, 1.2, 0.95], opacity: [0.6, 0.3, 0] }}
        transition={{ duration: 1.2 }}
      />
    </motion.div>
  )
}


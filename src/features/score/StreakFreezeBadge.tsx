import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { motionDuration, shouldReduceMotion } from '../../shared/motion/useMotionPrefs'

export function StreakFreezeBadge({
  count,
  variant = 'chip',
  consumeAnimation,
}: {
  count: number
  variant?: 'chip' | 'card'
  consumeAnimation?: { kind: 'freeze'; key: number; previousFreezes: number; nextFreezes: number } | null
}) {
  const reduced = shouldReduceMotion()
  const [consumePhase, setConsumePhase] = useState<'idle' | 'consuming' | 'settled'>('idle')
  const displayCount =
    consumePhase === 'consuming'
      ? (consumeAnimation?.previousFreezes ?? count)
      : consumePhase === 'settled'
        ? (consumeAnimation?.nextFreezes ?? count)
        : count
  const isConsuming = Boolean(consumeAnimation && consumePhase !== 'idle' && !reduced)
  const depth = displayCount >= 3 ? 3 : displayCount >= 2 ? 2 : 1
  const ringColor =
    depth === 3 ? 'rgba(56, 189, 248, 0.52)' : depth === 2 ? 'rgba(125, 211, 252, 0.5)' : 'rgba(186, 230, 253, 0.62)'
  const baseBg =
    depth === 3 ? 'rgba(56, 189, 248, 0.14)' : depth === 2 ? 'rgba(125, 211, 252, 0.12)' : 'rgba(186, 230, 253, 0.16)'
  const duration =
    depth === 3 ? motionDuration(1.75) || 1.75 : depth === 2 ? motionDuration(1.35) || 1.35 : motionDuration(1.0) || 1.0
  const maxScale = depth === 3 ? 1.12 : depth === 2 ? 1.2 : 1.3

  const className = [
    'relative overflow-hidden',
    variant === 'card'
      ? 'rounded-3xl border border-[var(--paper-border)] p-4 sm:p-5'
      : 'rounded-2xl border border-[var(--paper-border)] px-3 py-2',
    isConsuming ? 'streak-freeze-badge--consuming' : '',
  ]
    .filter(Boolean)
    .join(' ')

  useEffect(() => {
    if (!consumeAnimation || reduced || variant !== 'chip') return
    const startTimer = window.setTimeout(() => setConsumePhase('consuming'), 0)
    const settleTimer = window.setTimeout(() => setConsumePhase('settled'), 780)
    return () => {
      window.clearTimeout(startTimer)
      window.clearTimeout(settleTimer)
    }
  }, [consumeAnimation, reduced, variant])

  return (
    <div className={className} style={{ background: baseBg }}>
      {!reduced ? (
        <>
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 border"
            style={{ borderRadius: 'inherit', borderColor: ringColor }}
            animate={{ scale: [1, maxScale], opacity: [0.55, 0] }}
            transition={{ duration, repeat: Infinity, ease: 'easeOut' }}
          />
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 border"
            style={{ borderRadius: 'inherit', borderColor: ringColor }}
            animate={{ scale: [1, maxScale + 0.08], opacity: [0.42, 0] }}
            transition={{ duration: duration + 0.35, repeat: Infinity, ease: 'easeOut', delay: duration * 0.45 }}
          />
        </>
      ) : null}
      <div className="relative z-10 flex items-center gap-2">
        <span aria-hidden className={variant === 'card' ? 'text-2xl sm:text-3xl' : 'text-lg'}>
          {depth >= 2 ? '🧊' : '❄️'}
        </span>
        <div>
          <div className="font-mono text-[11px] uppercase opacity-70">freezes</div>
          <div className={variant === 'card' ? 'font-mono text-2xl font-black sm:text-3xl md:text-4xl' : 'font-mono text-lg font-bold'}>
            {displayCount}
          </div>
        </div>
      </div>
      {isConsuming ? (
        <div className="streak-freeze-steam" aria-hidden>
          <span />
          <span />
          <span />
        </div>
      ) : null}
    </div>
  )
}

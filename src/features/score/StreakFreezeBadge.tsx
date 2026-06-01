import { motion } from 'framer-motion'
import { motionDuration, shouldReduceMotion } from '../../shared/motion/useMotionPrefs'

export function StreakFreezeBadge({
  count,
  variant = 'chip',
}: {
  count: number
  variant?: 'chip' | 'card'
}) {
  const reduced = shouldReduceMotion()
  const depth = count >= 3 ? 3 : count >= 2 ? 2 : 1
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
  ].join(' ')

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
            {count}
          </div>
        </div>
      </div>
    </div>
  )
}

import { AnimatePresence, motion } from 'framer-motion'
import { motionDuration, shouldReduceMotion } from '../../shared/motion/useMotionPrefs'

export function CharacterPetHearts({ burst }: { burst: number }) {
  const duration = motionDuration(0.7)
  if (burst <= 0 || shouldReduceMotion() || duration === 0) return null

  const hearts = [
    { id: `${burst}-a`, drift: -8 },
    { id: `${burst}-b`, drift: 10 },
  ]

  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
      <AnimatePresence>
        {hearts.map((heart) => (
          <motion.span
            key={heart.id}
            className="absolute left-1/2 top-[18%] text-lg leading-none"
            style={{ color: 'var(--accent, #c45b7a)' }}
            initial={{ opacity: 0.95, y: 0, x: heart.drift, scale: 0.7 }}
            animate={{ opacity: 0, y: -28, x: heart.drift + heart.drift * 0.2, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration, ease: 'easeOut' }}
          >
            ♥
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  )
}

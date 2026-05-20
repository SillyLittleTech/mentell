import { motion } from 'framer-motion'
import { motionDuration, shouldReduceMotion } from '../../shared/motion/useMotionPrefs'

export function TruckDrop() {
  return (
    <motion.div
      className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2"
      initial={{ x: 120, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 140, opacity: 0 }}
      transition={{ duration: motionDuration(0.6) || 0.01, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <motion.img
        alt=""
        src="/asset/truck.png"
        draggable={false}
        className="h-20 w-auto select-none object-contain"
        animate={{ y: [0, -2, 0] }}
        transition={{ duration: motionDuration(0.35) || 0.01, repeat: shouldReduceMotion() ? 0 : 2 }}
        style={{ filter: 'drop-shadow(0 18px 26px rgba(0,0,0,0.22))' }}
      />
    </motion.div>
  )
}


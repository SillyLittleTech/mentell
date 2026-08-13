import { motion } from 'framer-motion'
import { MentellCharacter, type MentellCharacterProps } from './MentellCharacter'
import { motionDuration, shouldReduceMotion } from '../../shared/motion/useMotionPrefs'

export const DESK_CHARACTER_LAYOUT_ID = 'desk-character'

export function DeskCharacterShell({
  className,
  ...characterProps
}: MentellCharacterProps & { className?: string }) {
  const reduced = shouldReduceMotion()
  const duration = motionDuration(0.45)

  return (
    <motion.div
      layoutId={DESK_CHARACTER_LAYOUT_ID}
      transition={
        reduced || duration === 0
          ? { duration: 0 }
          : { duration, ease: [0.22, 0.8, 0.2, 1] }
      }
      className={className}
    >
      <MentellCharacter {...characterProps} className="h-full w-full" />
    </motion.div>
  )
}

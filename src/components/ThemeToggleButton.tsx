import { motion } from 'framer-motion'
import { publicUrl } from '../shared/publicUrl'
import { motionDuration } from '../shared/motion/useMotionPrefs'

export function ThemeToggleButton({
  mode,
  onToggle,
  className,
  variant = 'icon',
  showLabel = false,
}: {
  mode: 'light' | 'dark'
  onToggle: () => void
  className?: string
  variant?: 'icon' | 'menu'
  showLabel?: boolean
}) {
  const label = mode === 'dark' ? 'Light mode' : 'Dark mode'
  return (
    <motion.button
      type="button"
      className={`focus-ring inline-flex items-center gap-2 rounded-xl border border-[var(--paper-border)] ${
        variant === 'menu' ? 'px-3 py-2' : 'p-2'
      } ${className ?? ''}`}
      onClick={onToggle}
      aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      whileTap={{ scale: 0.95 }}
    >
      <motion.img
        key={mode}
        alt=""
        src={publicUrl(mode === 'dark' ? '/asset/light.png' : '/asset/dark.png')}
        className="h-8 w-8 shrink-0 select-none object-contain"
        draggable={false}
        initial={{ rotate: -180, scale: 0.86 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ duration: motionDuration(0.38) || 0 }}
      />
      {showLabel ? <span className="text-sm font-medium">{label}</span> : null}
    </motion.button>
  )
}

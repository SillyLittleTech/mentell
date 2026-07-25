import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from './useToast'
import { type Toast } from './ToastContext'

export function ToastContainer() {
  const { toasts, removeToast } = useToast()
  const [hovered, setHovered] = useState(false)

  const visibleToasts = [...toasts].reverse()

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 transition-all duration-300 pointer-events-none w-[320px]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <AnimatePresence>
        {visibleToasts.map((toast, index) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            index={index}
            isHovered={hovered}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

function ToastItem({
  toast,
  index,
  isHovered,
  onClose,
}: {
  toast: Toast
  index: number
  isHovered: boolean
  onClose: () => void
}) {
  const [isPaused, setIsPaused] = useState(false)
  const timerRef = useRef<number | undefined>(undefined)

  const duration = toast.duration ?? 4000
  const shouldAutoClose = !toast.isSticky

  useEffect(() => {
    if (!shouldAutoClose) return
    if (isHovered || isPaused) {
      window.clearTimeout(timerRef.current)
      return
    }

    timerRef.current = window.setTimeout(onClose, duration)
    return () => window.clearTimeout(timerRef.current)
  }, [shouldAutoClose, isHovered, isPaused, onClose, duration])

  // If not hovered, stack on top of each other.
  // Latest (index=0) is top, others cascade backwards (scale down and blurred).
  const yOffset = isHovered ? 0 : index * -8
  const scale = isHovered ? 1 : Math.max(1 - index * 0.05, 0.85)
  // When expanded, list them individually; when collapsed, fade older ones sharply
  const opacity = isHovered ? 1 : index === 0 ? 1 : Math.max(1 - index * 0.3, 0)
  const blur = isHovered ? 0 : index > 0 ? `${index * 2}px` : '0px'

  if (!isHovered && index > 3) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={{ opacity, y: yOffset, scale, filter: `blur(${blur})` }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={`pointer-events-auto flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 shadow-lg bg-[var(--paper-bg)] text-[var(--paper-ink)]
        ${toast.type === 'error' ? 'border-[var(--danger)]' : 'border-[var(--paper-border)]'}`}
      style={{
        zIndex: 50 - index,
        position: isHovered ? 'relative' : index === 0 ? 'relative' : 'absolute',
        bottom: isHovered ? 'auto' : 0,
        right: isHovered ? 'auto' : 0,
        transformOrigin: 'bottom center',
      }}
    >
      <div className="text-sm font-medium">{toast.message}</div>
      <button
        onClick={onClose}
        className="ml-2 rounded p-1 hover:bg-[var(--pill-surface)] opacity-70 hover:opacity-100 focus-ring"
        aria-label="Close toast"
      >
        ✕
      </button>
    </motion.div>
  )
}
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { isDebugMode } from '../../shared/debug/debugFlags'
import { motionDuration, shouldReduceMotion } from '../../shared/motion/useMotionPrefs'
import { AccountEmailSignInForm } from './AccountEmailSignInForm'
import { useAuthOptional } from '../../shared/firebase/AuthProvider'

export function EmailSignInModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const auth = useAuthOptional()
  const reduced = shouldReduceMotion()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (isDebugMode() || !auth) return null

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="email-sign-in-title"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduced ? undefined : { opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="paper w-full max-w-md rounded-3xl p-6 shadow-lg"
            initial={reduced ? false : { scale: 0.96, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={reduced ? undefined : { scale: 0.98, y: 8 }}
            transition={{ duration: motionDuration(0.25) || 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="email-sign-in-title" className="font-paper text-xl">
                  Sign in with email
                </h2>
                <p className="ink-muted mt-1 text-sm">
                  Password, new account, or a link sent to your inbox.
                </p>
              </div>
              <button
                type="button"
                className="focus-ring ink-muted rounded-xl px-2 py-1 text-sm hover:text-[var(--paper-ink)]"
                aria-label="Close"
                onClick={onClose}
              >
                Close
              </button>
            </div>

            <div className="mt-5">
              <AccountEmailSignInForm onSuccess={onClose} />
            </div>

            {auth.syncError ? (
              <p className="mt-4 text-sm" style={{ color: 'var(--danger)' }}>
                {auth.syncError}
              </p>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

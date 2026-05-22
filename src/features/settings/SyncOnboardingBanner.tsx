import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { GoogleSignInButton } from '../../components/GoogleSignInButton'
import { isFirebaseEnabled, isFirebaseSyncEnabled } from '../../shared/features/featureFlags'
import { useAppSettings } from '../../shared/settings/useAppSettings'
import { useAuthOptional } from '../../shared/firebase/AuthProvider'
import { shouldReduceMotion } from '../../shared/motion/useMotionPrefs'
import { EmailSignInModal } from './EmailSignInModal'

const bannerActionBtn =
  'focus-ring inline-flex items-center justify-center rounded-2xl border border-[var(--paper-border)] bg-[var(--paper-bg)] px-3.5 py-2 text-sm font-medium text-[var(--paper-ink)] shadow-sm transition-colors hover:bg-[var(--pill-surface)]'

export function SyncOnboardingBanner({ shakeKey = 0 }: { shakeKey?: number }) {
  const { settings, updateSettings } = useAppSettings()
  const auth = useAuthOptional()
  const reduced = shouldReduceMotion()
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)

  useEffect(() => {
    if (auth?.pendingEmailLinkConfirm) setEmailModalOpen(true)
  }, [auth?.pendingEmailLinkConfirm])

  if (!isFirebaseEnabled() || !isFirebaseSyncEnabled()) return null
  if (settings.syncPromptDismissed) return null
  if (auth?.user) return null

  async function signInGoogle() {
    if (!auth) return
    setGoogleBusy(true)
    try {
      await auth.signInWithGoogle()
    } catch {
      /* syncError on auth */
    } finally {
      setGoogleBusy(false)
    }
  }

  return (
    <>
      <motion.div
        className="paper mb-4 rounded-3xl border-l-[3px] border-l-[var(--success)] px-4 py-3.5"
        animate={
          shakeKey > 0 && !reduced
            ? { x: [0, -10, 10, -8, 8, -4, 4, 0] }
            : { x: 0 }
        }
        transition={{ duration: 0.45 }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-base font-medium leading-snug text-[var(--paper-ink)]">
              Sync across devices
            </p>
            <p className="ink-muted mt-0.5 text-sm leading-relaxed">
              Sign in to back up your journal. <span className="opacity-90">Not now</span> keeps
              this device local-only.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            <GoogleSignInButton
              size="sm"
              disabled={googleBusy}
              onClick={() => void signInGoogle()}
            />
            <button type="button" className={bannerActionBtn} onClick={() => setEmailModalOpen(true)}>
              Sign in with email
            </button>
            <button
              type="button"
              className={bannerActionBtn}
              onClick={() => updateSettings({ syncPromptDismissed: true })}
            >
              Not now
            </button>
            <Link to="/settings" className={bannerActionBtn}>
              Settings
            </Link>
          </div>
        </div>

        {auth?.syncError ? (
          <p className="mt-2 text-sm" style={{ color: 'var(--danger)' }}>
            {auth.syncError}
          </p>
        ) : null}
      </motion.div>

      <EmailSignInModal open={emailModalOpen} onClose={() => setEmailModalOpen(false)} />
    </>
  )
}

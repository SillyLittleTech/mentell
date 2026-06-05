import { useState } from 'react'
import { GoogleGIcon } from '../../components/GoogleGIcon'
import { useAuthOptional } from '../../shared/firebase/AuthProvider'
import { AccountEmailSignInForm } from './AccountEmailSignInForm'

/** Full sign-in block for Settings (Google + inline email). */
export function AccountSignInPanel() {
  const auth = useAuthOptional()
  const [busy, setBusy] = useState(false)

  if (!auth) return null

  const authApi = auth
  const btnPrimary =
    'focus-ring rounded-2xl border border-[var(--paper-border)] bg-[rgba(42,155,88,0.12)] px-4 py-2 text-sm font-semibold disabled:opacity-60'

  async function signInGoogle() {
    setBusy(true)
    try {
      await authApi.signInWithGoogle()
    } catch {
      /* syncError on auth */
    } finally {
      setBusy(false)
    }
  }

  if (auth.pendingEmailLinkConfirm) {
    return (
      <div className="mt-4">
        <AccountEmailSignInForm />
        {auth.syncError ? (
          <p className="mt-3 text-sm" style={{ color: 'var(--danger)' }}>
            {auth.syncError}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-4">
      <button
        type="button"
        className={`${btnPrimary} inline-flex w-full items-center justify-center gap-2`}
        disabled={busy}
        onClick={() => void signInGoogle()}
      >
        <GoogleGIcon />
        Continue with Google
      </button>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-[var(--paper-border)]" />
        <span className="ink-muted text-xs">or email</span>
        <div className="h-px flex-1 bg-[var(--paper-border)]" />
      </div>

      <AccountEmailSignInForm />

      {auth.syncError ? (
        <p className="text-sm" style={{ color: 'var(--danger)' }}>
          {auth.syncError}
        </p>
      ) : null}
    </div>
  )
}

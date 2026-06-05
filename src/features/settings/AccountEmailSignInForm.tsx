import { useState } from 'react'
import { useAuthOptional } from '../../shared/firebase/AuthProvider'

export function AccountEmailSignInForm({ onSuccess }: { onSuccess?: () => void }) {
  const auth = useAuthOptional()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  if (!auth) return null

  const inputClass =
    'focus-ring w-full rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-2.5 text-sm'
  const btnPrimary =
    'focus-ring rounded-2xl border border-[var(--paper-border)] bg-[rgba(42,155,88,0.12)] px-4 py-2 text-sm font-semibold disabled:opacity-60'
  const btnSecondary =
    'focus-ring rounded-2xl border border-[var(--paper-border)] px-4 py-2 text-sm disabled:opacity-60'

  async function run(fn: () => Promise<void>, dismissOnSuccess = false) {
    setBusy(true)
    try {
      await fn()
      if (dismissOnSuccess) onSuccess?.()
    } catch {
      /* syncError set on auth */
    } finally {
      setBusy(false)
    }
  }

  if (auth.pendingEmailLinkConfirm) {
    return (
      <div className="grid gap-3">
        <p className="text-sm font-medium">Confirm your email</p>
        <p className="ink-muted text-xs">
          Opened the sign-in link on a different device? Enter the email where you received the
          link.
        </p>
        <input
          type="email"
          autoComplete="email"
          className={inputClass}
          placeholder="you@example.com"
          value={confirmEmail}
          onChange={(e) => setConfirmEmail(e.target.value)}
        />
        <button
          type="button"
          className={btnPrimary}
          disabled={busy || !confirmEmail.trim()}
          onClick={() =>
            void run(() => auth.confirmEmailLinkSignIn(confirmEmail), true)
          }
        >
          {busy ? 'Signing in…' : 'Complete sign-in'}
        </button>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3">
        <input
          type="email"
          autoComplete="email"
          className={inputClass}
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          autoComplete="current-password"
          className={inputClass}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={btnPrimary}
            disabled={busy || !email.trim() || !password}
            onClick={() =>
              void run(() => auth.signInWithEmailPassword(email, password), true)
            }
          >
            Sign in
          </button>
          <button
            type="button"
            className={btnSecondary}
            disabled={busy || !email.trim() || password.length < 6}
            onClick={() =>
              void run(() => auth.createAccountWithEmailPassword(email, password), true)
            }
          >
            Create account
          </button>
        </div>
        <button
          type="button"
          className="ink-muted text-left text-xs underline-offset-2 hover:underline disabled:opacity-60"
          disabled={busy || !email.trim()}
          onClick={() =>
            void run(async () => {
              await auth.sendPasswordReset(email)
              setResetSent(true)
            })
          }
        >
          Forgot password?
        </button>
        {resetSent ? (
          <p className="ink-muted text-xs">If that email has an account, a reset link was sent.</p>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-[var(--paper-border)]" />
        <span className="ink-muted text-xs">or</span>
        <div className="h-px flex-1 bg-[var(--paper-border)]" />
      </div>

      <div className="grid gap-2">
        <button
          type="button"
          className={btnSecondary}
          disabled={busy || !email.trim()}
          onClick={() => void run(() => auth.sendSignInLink(email))}
        >
          Send sign-in link
        </button>
        {auth.emailLinkSent ? (
          <p className="ink-muted text-xs">
            Check your email for a sign-in link. You can close this until you open the link.
          </p>
        ) : null}
      </div>
    </div>
  )
}

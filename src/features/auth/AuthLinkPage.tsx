import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthOptional } from '../../shared/firebase/AuthProvider'
import {
  createAuthHandoffCode,
  isAuthHandoffConfigured,
  type AuthHandoffCodeResponse,
} from '../../shared/firebase/authHandoffClient'
import { isAuthHandoffEnabled } from '../../shared/features/featureFlags'
import { useOnlineStatus } from '../../shared/offline/useOnlineStatus'
import { isFileProtocol, isOfflineZipBuild } from '../../shared/platform/runtime'

function formatExpiry(expiresAt: number) {
  const sec = Math.max(0, Math.round((expiresAt - Date.now()) / 1000))
  if (sec < 60) return `${sec}s`
  return `${Math.floor(sec / 60)}m ${sec % 60}s`
}

function formatCodeInput(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
}

function canCreateLinkCodes() {
  return !isFileProtocol() && !isOfflineZipBuild()
}

function AuthLinkGeneratePanel() {
  const auth = useAuthOptional()
  const isOnline = useOnlineStatus()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [handoff, setHandoff] = useState<AuthHandoffCodeResponse | null>(null)

  useEffect(() => {
    if (!handoff) return
    const tick = () => {
      if (Date.now() >= handoff.expiresAt) setHandoff(null)
    }
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [handoff])

  if (!auth?.user) return null

  // eslint-disable-next-line react-hooks/purity
  const expired = handoff ? Date.now() >= handoff.expiresAt : false

  return (
    <div className="space-y-4">
      <p className="ink-muted text-sm">
        Generate a one-time code for an offline ZIP, desktop app, or another device. The code
        expires in about 10 minutes and works once.
      </p>
      {!isOnline ? (
        <p className="text-sm" style={{ color: 'var(--danger)' }}>
          You&apos;re offline. Connect to the internet to create a link code.
        </p>
      ) : null}
      {handoff && !expired ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-[var(--paper-border)] bg-[var(--paper-bg)] px-4 py-4 text-center font-mono text-3xl tracking-[0.35em]">
            {handoff.code}
          </div>
          <p className="ink-muted text-center text-xs">
            Expires in {formatExpiry(handoff.expiresAt)} · enter on the other device under Link
            accounts
          </p>
          <button
            type="button"
            className="focus-ring w-full rounded-2xl border border-[var(--paper-border)] px-4 py-2.5 text-sm font-semibold"
            onClick={() => {
              void navigator.clipboard?.writeText(handoff.code)
            }}
          >
            Copy code
          </button>
          <button
            type="button"
            className="focus-ring w-full rounded-2xl border border-[var(--paper-border)] px-4 py-2 text-sm"
            onClick={() => setHandoff(null)}
          >
            Create another code
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={!isOnline || busy}
          className="focus-ring w-full rounded-2xl border border-[var(--paper-ink)] bg-[var(--paper-ink)] px-4 py-3 text-sm font-semibold text-[var(--paper-bg)] disabled:opacity-60"
          onClick={() => {
            setBusy(true)
            setError(null)
            void auth.user!
              .getIdToken()
              .then((token) => createAuthHandoffCode(token))
              .then(setHandoff)
              .catch((e) => setError(e instanceof Error ? e.message : String(e)))
              .finally(() => setBusy(false))
          }}
        >
          {busy ? 'Creating…' : 'Generate link code'}
        </button>
      )}
      {error ? (
        <p className="text-sm" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      ) : null}
    </div>
  )
}

function AuthLinkRedeemPanel() {
  const auth = useAuthOptional()
  const isOnline = useOnlineStatus()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const showForOffline = isOfflineZipBuild() || isFileProtocol()

  if (!auth || auth.user) return null

  return (
    <div className="space-y-4">
      <p className="ink-muted text-sm">
        {showForOffline ? (
          <>
            Your offline copy opens without a network after you&apos;ve saved it once. To connect
            cloud backup, go online briefly: sign in on the <strong>hosted Mentell app</strong>,
            open <strong>Link accounts</strong>, generate a code, then enter it here.
          </>
        ) : (
          <>
            Enter the link code from the hosted Mentell app to sign in on this device without Google
            or email here.
          </>
        )}
      </p>
      {!isOnline ? (
        <p className="text-sm" style={{ color: 'var(--danger)' }}>
          You&apos;re offline. Connect to the internet to redeem a link code.
        </p>
      ) : null}
      <label className="grid gap-1 text-sm">
        <span className="ink-muted text-xs font-medium">Link code</span>
        <input
          type="text"
          inputMode="text"
          autoComplete="one-time-code"
          className="focus-ring rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3 font-mono text-lg tracking-widest"
          placeholder="AB12CD34"
          value={code}
          disabled={!isOnline || busy}
          onChange={(e) => setCode(formatCodeInput(e.target.value))}
        />
      </label>
      <button
        type="button"
        disabled={!isOnline || busy || code.length < 6}
        className="focus-ring w-full rounded-2xl border border-[var(--paper-ink)] bg-[var(--paper-ink)] px-4 py-3 text-sm font-semibold text-[var(--paper-bg)] disabled:opacity-60"
        onClick={() => {
          setBusy(true)
          setError(null)
          void auth
            .redeemHandoffCode(code)
            .then(() => navigate('/settings', { replace: true }))
            .catch((e) => setError(e instanceof Error ? e.message : String(e)))
            .finally(() => setBusy(false))
        }}
      >
        {busy ? 'Linking…' : 'Link account'}
      </button>
      {error ? (
        <p className="text-sm" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** Hidden route for offline ↔ web account linking via one-time codes. */
export function AuthLinkPage() {
  const auth = useAuthOptional()
  const navigate = useNavigate()
  const enabled = isAuthHandoffEnabled() && isAuthHandoffConfigured()

  useEffect(() => {
    if (!enabled) navigate('/settings', { replace: true })
  }, [enabled, navigate])

  if (!enabled) return null

  const signedIn = Boolean(auth?.user)
  const canCreate = canCreateLinkCodes()

  return (
    <section className="paper mx-auto mt-12 max-w-md rounded-3xl p-6">
      <Link
        to="/settings"
        className="ink-muted focus-ring text-xs font-medium underline-offset-2 hover:underline"
      >
        ← Back to Settings
      </Link>
      <h1 className="font-paper mt-4 text-2xl">Link accounts</h1>

      {auth?.loading ? (
        <p className="ink-muted mt-4 text-sm">Checking sign-in…</p>
      ) : signedIn && canCreate ? (
        <div className="mt-5">
          <AuthLinkGeneratePanel />
        </div>
      ) : signedIn ? (
        <div className="mt-5 space-y-3">
          <p className="ink-muted text-sm">
            You&apos;re signed in on this copy. To link another offline device, sign in on the
            hosted Mentell app and open Link accounts there to generate a code.
          </p>
          <button
            type="button"
            className="focus-ring w-full rounded-2xl border border-[var(--paper-border)] px-4 py-2.5 text-sm font-semibold"
            onClick={() => navigate('/settings')}
          >
            Return to Settings
          </button>
        </div>
      ) : (
        <div className="mt-5">
          <AuthLinkRedeemPanel />
        </div>
      )}
    </section>
  )
}

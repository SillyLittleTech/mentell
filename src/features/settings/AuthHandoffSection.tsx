import { useEffect, useState } from 'react'
import { useAuthOptional } from '../../shared/firebase/AuthProvider'
import {
  createAuthHandoffCode,
  isAuthHandoffConfigured,
  type AuthHandoffCodeResponse,
} from '../../shared/firebase/authHandoffClient'
import { isAuthHandoffEnabled } from '../../shared/features/featureFlags'
import { isFileProtocol, isOfflineZipBuild } from '../../shared/platform/runtime'
import { useOnlineStatus } from '../../shared/offline/useOnlineStatus'

function formatExpiry(expiresAt: number) {
  const sec = Math.max(0, Math.round((expiresAt - Date.now()) / 1000))
  if (sec < 60) return `${sec}s`
  return `${Math.floor(sec / 60)}m ${sec % 60}s`
}

/** Hosted web: generate a one-time code for offline / desktop copies. */
export function AuthHandoffCreateSection() {
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

  if (!isAuthHandoffEnabled() || !isAuthHandoffConfigured()) return null
  if (!auth?.user) return null
  if (isFileProtocol() || isOfflineZipBuild()) return null

  const expired = handoff ? Date.now() >= handoff.expiresAt : false

  return (
    <div className="rounded-2xl border border-[var(--paper-border)] p-4">
      <div className="text-sm font-medium">Link offline copy</div>
      <p className="ink-muted mt-1 text-xs">
        Generate a short code to sign in on an offline ZIP, desktop app, or another device without
        Google or email there. The code expires in about 10 minutes and works once.
      </p>
      {!isOnline ? (
        <p className="mt-2 text-xs" style={{ color: 'var(--danger)' }}>
          You&apos;re offline. Connect to the internet to create a link code.
        </p>
      ) : null}
      {handoff && !expired ? (
        <div className="mt-3 space-y-2">
          <div className="rounded-2xl border border-[var(--paper-border)] bg-[var(--paper-bg)] px-4 py-3 text-center font-mono text-2xl tracking-[0.35em]">
            {handoff.code}
          </div>
          <p className="ink-muted text-center text-xs">
            Expires in {formatExpiry(handoff.expiresAt)} · enter on the other device under Account
          </p>
          <button
            type="button"
            className="focus-ring w-full rounded-2xl border border-[var(--paper-border)] px-4 py-2 text-sm"
            onClick={() => {
              void navigator.clipboard?.writeText(handoff.code)
            }}
          >
            Copy code
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={!isOnline || busy}
          className="focus-ring mt-3 w-full rounded-2xl border border-[var(--paper-border)] px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
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
          {busy ? 'Creating…' : 'Create link code'}
        </button>
      )}
      {error ? (
        <p className="mt-2 text-xs" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      ) : null}
    </div>
  )
}

function formatCodeInput(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
}

/** Offline / file copies redeem a code from the web app (needs network once). */
export function AuthHandoffRedeemSection() {
  const auth = useAuthOptional()
  const isOnline = useOnlineStatus()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const showForOffline = isOfflineZipBuild() || isFileProtocol()

  if (!isAuthHandoffEnabled() || !isAuthHandoffConfigured()) return null
  if (!auth || auth.user) return null

  return (
    <div className="rounded-2xl border border-[var(--paper-border)] p-4">
      <div className="text-sm font-medium">Link with web app code</div>
      <p className="ink-muted mt-1 text-xs">
        {showForOffline ? (
          <>
            Your offline copy opens without a network after you&apos;ve saved it once. To connect
            cloud backup, go online briefly: sign in on the{' '}
            <strong>hosted Mentell app</strong>, create a link code, then enter it here.
          </>
        ) : (
          <>
            Have a link code from the hosted app? Enter it here to sign in without email or Google
            on this device.
          </>
        )}
      </p>
      {!isOnline ? (
        <p className="mt-2 text-xs" style={{ color: 'var(--danger)' }}>
          You&apos;re offline. Connect to the internet to redeem a link code.
        </p>
      ) : null}
      <label className="mt-3 grid gap-1 text-sm">
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
        className="focus-ring mt-3 w-full rounded-2xl border border-[var(--paper-ink)] bg-[var(--paper-ink)] px-4 py-2.5 text-sm font-semibold text-[var(--paper-bg)] disabled:opacity-60"
        onClick={() => {
          setBusy(true)
          setError(null)
          void auth
            .redeemHandoffCode(code)
            .catch((e) => setError(e instanceof Error ? e.message : String(e)))
            .finally(() => setBusy(false))
        }}
      >
        {busy ? 'Linking…' : 'Link account'}
      </button>
      {error ? (
        <p className="mt-2 text-xs" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      ) : null}
    </div>
  )
}

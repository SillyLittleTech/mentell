import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { DeskCharacterLayout } from '../character/DeskCharacterLayout'
import { getFirebaseAuth } from '../../shared/firebase/firebaseApp'
import { isFirebaseEnabled } from '../../shared/features/featureFlags'
import { getFirestore, doc, setDoc } from 'firebase/firestore'
import { useAppSettings } from '../../shared/settings/useAppSettings'

function tokenFromLocation() {
  const search = new URLSearchParams(window.location.search).get('token')
  if (search?.trim()) return search.trim()
  const hash = window.location.hash
  const qIndex = hash.indexOf('?')
  if (qIndex >= 0) {
    return new URLSearchParams(hash.slice(qIndex + 1)).get('token')?.trim() || ''
  }
  return ''
}

type VerifyResult = { ok: boolean; error?: string }

const verifyResults = new Map<string, VerifyResult>()
const verifyInflight = new Map<string, Promise<VerifyResult>>()

async function requestVerify(token: string): Promise<VerifyResult> {
  const cached = verifyResults.get(token)
  if (cached) return cached
  const pending = verifyInflight.get(token)
  if (pending) return pending

  const promise = (async () => {
    const apiBase = (import.meta.env.VITE_PUSH_API_BASE ?? '').trim().replace(/\/$/, '')
    if (!apiBase) return { ok: false, error: 'Email API is not configured.' }

    const res = await fetch(`${apiBase}/email/verify?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const text = await res.text().catch(() => '')
    let error: string | undefined
    if (text) {
      try {
        const parsed = JSON.parse(text) as { error?: string }
        error = parsed.error
      } catch {
        error = text
      }
    }
    const result: VerifyResult = res.ok
      ? { ok: true }
      : { ok: false, error: error || 'Failed to verify token.' }
    verifyResults.set(token, result)
    verifyInflight.delete(token)
    return result
  })()

  verifyInflight.set(token, promise)
  return promise
}

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [errorMsg, setErrorMsg] = useState('')
  const { updateSettings } = useAppSettings()

  const token = searchParams.get('token')?.trim() || tokenFromLocation()

  useEffect(() => {
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus('error')
      setErrorMsg('No token provided in URL.')
      return
    }

    let cancelled = false
    void requestVerify(token)
      .then(async (result) => {
        if (cancelled) return
        if (!result.ok) {
          setStatus('error')
          setErrorMsg(result.error || 'Failed to verify token.')
          return
        }
        setStatus('success')
        updateSettings({ emailVerified: true })
        if (isFirebaseEnabled()) {
          const auth = getFirebaseAuth()
          if (auth?.currentUser) {
            const db = getFirestore()
            await setDoc(
              doc(db, 'users', auth.currentUser.uid, 'meta', 'settings'),
              { emailNotification: { verified: true } },
              { merge: true },
            ).catch(() => {})
          }
        }
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
        setErrorMsg('Network error while verifying token.')
      })

    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <DeskCharacterLayout>
      <div className="space-y-4">
        <section className="paper rounded-3xl p-6 text-center">
          <div className="font-paper text-2xl mb-4">Email Verification</div>

          {status === 'verifying' && (
            <p className="ink-muted text-sm">Verifying your email address...</p>
          )}

          {status === 'success' && (
            <>
              <p className="text-green-600 font-medium text-lg mb-4">Email verified successfully!</p>
              <p className="ink-muted text-sm mb-6">You will now receive your scheduled emails.</p>
              <button
                onClick={() => navigate('/settings')}
                className="focus-ring rounded-2xl border border-[var(--paper-border)] px-6 py-2 text-sm font-semibold"
              >
                Return to Settings
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <p className="text-[var(--danger)] font-medium text-lg mb-4">Verification failed</p>
              <p className="ink-muted text-sm mb-6">{errorMsg}</p>
              <button
                onClick={() => navigate('/settings')}
                className="focus-ring rounded-2xl border border-[var(--paper-border)] px-6 py-2 text-sm font-semibold"
              >
                Return to Settings
              </button>
            </>
          )}
        </section>
      </div>
    </DeskCharacterLayout>
  )
}

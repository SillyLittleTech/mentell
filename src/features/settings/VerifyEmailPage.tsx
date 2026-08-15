import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { DeskCharacterLayout } from '../character/DeskCharacterLayout'
import { getFirebaseAuth } from '../../shared/firebase/firebaseApp'
import { isFirebaseEnabled } from '../../shared/features/featureFlags'
import { getFirestore, doc, setDoc } from 'firebase/firestore'
import { useAppSettings } from '../../shared/settings/useAppSettings'

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [errorMsg, setErrorMsg] = useState('')
  const { updateSettings } = useAppSettings()

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setTimeout(() => {
        setStatus('error')
        setErrorMsg('No token provided in URL.')
      }, 0)
      return
    }

    async function verifyToken() {
      try {
        const res = await fetch(`${import.meta.env.VITE_PUSH_API_BASE}/email/verify?token=${encodeURIComponent(token!)}`)
        const data = await res.json()
        if (res.ok) {
          setStatus('success')
          updateSettings({ emailVerified: true })
          if (isFirebaseEnabled()) {
            const auth = getFirebaseAuth()
            if (auth?.currentUser) {
               const db = getFirestore()
               await setDoc(doc(db, 'users', auth.currentUser.uid, 'meta', 'settings'), { emailNotification: { verified: true } }, { merge: true }).catch(() => {})
            }
          }
        } else {
          setStatus('error')
          setErrorMsg(data.error || 'Failed to verify token.')
        }
      } catch {
        setStatus('error')
        setErrorMsg('Network error while verifying token.')
      }
    }

    void verifyToken()
  }, [searchParams])

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

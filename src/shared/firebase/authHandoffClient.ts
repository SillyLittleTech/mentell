import { signInWithCustomToken } from 'firebase/auth'
import { getFirebaseAuth } from './firebaseApp'
import { finishSignIn } from './postSignIn'
import type { PostSignInCallbacks } from './postSignIn'

function normalizeApiBase(raw: string | undefined) {
  if (!raw?.trim()) return ''
  return raw.trim().replace(/\/$/, '')
}

/** Worker origin for auth handoff (defaults to VITE_PUSH_API_BASE). */
export function getAuthHandoffApiBase(): string {
  const explicit = normalizeApiBase(import.meta.env.VITE_AUTH_HANDOFF_API_BASE)
  if (explicit) return explicit
  return normalizeApiBase(import.meta.env.VITE_PUSH_API_BASE)
}

export function isAuthHandoffConfigured(): boolean {
  return Boolean(getAuthHandoffApiBase())
}

export type AuthHandoffCodeResponse = {
  code: string
  expiresInSec: number
  expiresAt: number
}

export async function createAuthHandoffCode(idToken: string): Promise<AuthHandoffCodeResponse> {
  const base = getAuthHandoffApiBase()
  if (!base) throw new Error('Auth handoff is not configured')

  const res = await fetch(`${base}/auth/handoff/create`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
  })

  const body = (await res.json().catch(() => ({}))) as AuthHandoffCodeResponse & { error?: string }
  if (!res.ok) {
    throw new Error(body.error ?? `Could not create link code (${res.status})`)
  }
  if (!body.code) throw new Error('Invalid handoff response')
  return body
}

export async function redeemAuthHandoffCode(
  code: string,
  callbacks: PostSignInCallbacks,
): Promise<void> {
  const base = getAuthHandoffApiBase()
  if (!base) throw new Error('Auth handoff is not configured')

  const auth = getFirebaseAuth()
  if (!auth) throw new Error('Cloud sign-in is not configured')

  const res = await fetch(`${base}/auth/handoff/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: code.trim().toUpperCase() }),
  })

  const body = (await res.json().catch(() => ({}))) as { customToken?: string; error?: string }
  if (!res.ok) {
    throw new Error(body.error ?? `Could not redeem link code (${res.status})`)
  }
  if (!body.customToken) throw new Error('Invalid handoff response')

  await signInWithCustomToken(auth, body.customToken)
  await finishSignIn(auth, callbacks)
}

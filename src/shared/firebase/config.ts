import { isFirebaseEnabled } from '../features/featureFlags'

export type FirebaseWebConfig = {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

export function getFirebaseWebConfig(): FirebaseWebConfig | null {
  if (!isFirebaseEnabled()) return null
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim()
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim()
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim()
  const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim()
  const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim()
  const appId = import.meta.env.VITE_FIREBASE_APP_ID?.trim()
  if (!apiKey || !authDomain || !projectId || !storageBucket || !messagingSenderId || !appId) {
    return null
  }
  return { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId }
}

/** Redirect URI Google OAuth must allow (derived from VITE_FIREBASE_AUTH_DOMAIN). */
export function getOAuthRedirectUri(): string | null {
  const config = getFirebaseWebConfig()
  if (!config?.authDomain) return null
  const host = config.authDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')
  return `https://${host}/__/auth/handler`
}

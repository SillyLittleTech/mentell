import { createContext, useContext } from 'react'
import type { User } from 'firebase/auth'

export type AuthContextValue = {
  enabled: boolean
  user: User | null
  loading: boolean
  syncEnabled: boolean
  syncError: string | null
  lastSyncedAt: number | null
  emailLinkSent: boolean
  pendingEmailLinkConfirm: boolean
  signInWithGoogle: () => Promise<void>
  signInWithEmailPassword: (email: string, password: string) => Promise<void>
  createAccountWithEmailPassword: (email: string, password: string) => Promise<void>
  sendPasswordReset: (email: string) => Promise<void>
  sendSignInLink: (email: string) => Promise<void>
  confirmEmailLinkSignIn: (email: string) => Promise<void>
  signOut: () => Promise<void>
  setSyncEnabled: (on: boolean) => Promise<void>
  syncNow: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function useAuthOptional() {
  return useContext(AuthContext)
}

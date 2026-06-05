import type { ActionCodeSettings } from 'firebase/auth'
import { publicUrl } from '../publicUrl'
import { getFirebaseWebConfig } from './config'

export const EMAIL_FOR_SIGN_IN_KEY = 'emailForSignIn'

export function getEmailLinkContinueUrl(): string {
  const path = publicUrl('settings').replace(/^\//, '')
  const base = `${window.location.origin}/${path}`.replace(/([^:]\/)\/+/g, '$1')
  return base
}

export function getEmailLinkActionCodeSettings(): ActionCodeSettings {
  const settings: ActionCodeSettings = {
    url: getEmailLinkContinueUrl(),
    handleCodeInApp: true,
  }
  const config = getFirebaseWebConfig()
  if (config?.authDomain) {
    const host = config.authDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')
    if (!host.endsWith('.firebaseapp.com')) {
      settings.linkDomain = host
    }
  }
  return settings
}

export function clearEmailLinkUrl() {
  const url = new URL(window.location.href)
  const params = [
    'oobCode',
    'mode',
    'apiKey',
    'lang',
    'continueUrl',
    'oobLink',
    'tenantId',
  ]
  let changed = false
  for (const p of params) {
    if (url.searchParams.has(p)) {
      url.searchParams.delete(p)
      changed = true
    }
  }
  if (changed) {
    const next = url.pathname + (url.search ? url.search : '') + url.hash
    window.history.replaceState({}, document.title, next)
  }
}

export function readStoredEmailForSignIn(): string | null {
  return window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY)
}

export function storeEmailForSignIn(email: string) {
  window.localStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, email.trim())
}

export function clearStoredEmailForSignIn() {
  window.localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY)
}

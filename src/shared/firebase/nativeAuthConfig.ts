import { publicUrl } from '../publicUrl'
import { isNativeShell } from '../platform/runtime'

/** HTTPS relay page that forwards Firebase email-link params into the desktop app. */
const DEFAULT_NATIVE_EMAIL_LINK_CONTINUE_URL =
  'https://projects.sillylittle.tech/mentell/auth/deeplink.html'

/** Google OAuth 2.0 Web client ID (Firebase Console → Authentication → Google → Web SDK config). */
export function getGoogleOAuthClientId(): string | null {
  return import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID?.trim() || null
}

export function getNativeEmailLinkContinueUrl(): string {
  const override = import.meta.env.VITE_NATIVE_AUTH_CONTINUE_URL?.trim()
  if (override) return override
  return DEFAULT_NATIVE_EMAIL_LINK_CONTINUE_URL
}

export function getEmailLinkContinueUrl(): string {
  if (isNativeShell()) {
    return getNativeEmailLinkContinueUrl()
  }
  const path = publicUrl('settings').replace(/^\//, '')
  const base = `${window.location.origin}/${path}`.replace(/([^:]\/)\/+/g, '$1')
  return base
}

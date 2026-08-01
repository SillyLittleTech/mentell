import { publicUrl } from '../publicUrl'
import { shouldUseHostedEmailContinueUrl } from './authCapabilities'

/** HTTPS relay page that forwards Firebase email-link params into the desktop app. */
const DEFAULT_HOSTED_EMAIL_LINK_CONTINUE_URL =
  'https://projects.sillylittle.tech/mentell/auth/deeplink.html'

/** Optional override for hosted/native email-link continue URL. */
export function getHostedEmailLinkContinueUrl(): string {
  const override = import.meta.env.VITE_NATIVE_AUTH_CONTINUE_URL?.trim()
  if (override) return override
  return DEFAULT_HOSTED_EMAIL_LINK_CONTINUE_URL
}

export function getEmailLinkContinueUrl(): string {
  if (shouldUseHostedEmailContinueUrl()) {
    return getHostedEmailLinkContinueUrl()
  }
  const path = publicUrl('settings').replace(/^\//, '')
  const base = `${window.location.origin}/${path}`.replace(/([^:]\/)\/+/g, '$1')
  return base
}

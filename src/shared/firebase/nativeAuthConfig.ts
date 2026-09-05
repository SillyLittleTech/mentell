import { publicUrl } from '../../shared/publicUrl'
import { isFileProtocol, isOfflineZipBuild } from '../../shared/platform/runtime'
import { shouldUseHostedEmailContinueUrl } from './authCapabilities'

/** Hosted SPA route that shows the desktop-app handoff UI for email links. */
const DEFAULT_HOSTED_EMAIL_LINK_CONTINUE_URL =
  'https://projects.slt.ong/mentell/auth/deeplink'

/** Optional override for hosted/native email-link continue URL. */
export function getHostedEmailLinkContinueUrl(): string {
  const override = import.meta.env.VITE_NATIVE_AUTH_CONTINUE_URL?.trim()
  let url = override || DEFAULT_HOSTED_EMAIL_LINK_CONTINUE_URL
  if (isOfflineZipBuild() || isFileProtocol()) {
    const parsed = new URL(url)
    parsed.searchParams.set('offline', '1')
    url = parsed.toString()
  }
  return url
}

export function getEmailLinkContinueUrl(): string {
  if (shouldUseHostedEmailContinueUrl()) {
    return getHostedEmailLinkContinueUrl()
  }
  const path = publicUrl('settings').replace(/^\//, '')
  const base = `${window.location.origin}/${path}`.replace(/([^:]\/)\/+/g, '$1')
  return base
}

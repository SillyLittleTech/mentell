import { isCapacitor, isFileProtocol, isOfflineZipBuild, isTauri } from '../platform/runtime'
import { isAuthHandoffConfigured } from './authHandoffClient'
import { isAuthHandoffEnabled } from '../features/featureFlags'

const HOSTED_SIGN_IN_URL = 'https://mentell.slt.ong/settings'
const HOSTED_LINK_URL = 'https://mentell.slt.ong/auth/link'

/** Google popup/redirect only works on https (or localhost dev). Tauri uses system browser. */
export function supportsInAppGoogleSignIn(): boolean {
  if (isTauri()) return true
  if (isOfflineZipBuild() || isFileProtocol()) return false
  if (typeof window === 'undefined') return false
  return (
    window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  )
}

export function getOfflineAuthNotice(): string | null {
  if (isTauri()) return null
  if (!isOfflineZipBuild() && !isFileProtocol()) return null
  if (isAuthHandoffEnabled() && isAuthHandoffConfigured()) {
    return 'Use Link accounts with a code from the hosted Mentell app. Your offline copy opens without network after the first save.'
  }
  return 'This offline copy cannot complete Google sign-in locally. Use the hosted Mentell app or desktop app for cloud backup.'
}

export function getHostedSignInUrl(): string {
  if (isAuthHandoffEnabled() && isAuthHandoffConfigured()) {
    return HOSTED_LINK_URL
  }
  return HOSTED_SIGN_IN_URL
}

export function shouldUseHostedEmailContinueUrl(): boolean {
  if (isTauri()) return false
  if (isCapacitor()) return true
  return isOfflineZipBuild() || isFileProtocol()
}

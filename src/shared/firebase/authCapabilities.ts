import { isCapacitor, isFileProtocol, isOfflineZipBuild, isTauri } from '../platform/runtime'

const HOSTED_SIGN_IN_URL = 'https://mentell.sillylittle.tech/settings'

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
  return 'This offline copy cannot complete Google sign-in locally. Use the hosted Mentell app or desktop app for cloud backup.'
}

export function getHostedSignInUrl(): string {
  return HOSTED_SIGN_IN_URL
}

export function shouldUseHostedEmailContinueUrl(): boolean {
  if (isTauri()) return false
  if (isCapacitor()) return true
  return isOfflineZipBuild() || isFileProtocol()
}

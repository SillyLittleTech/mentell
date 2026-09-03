import { isTauri as apiIsTauri } from '@tauri-apps/api/core'
import { isSignInWithEmailLink } from 'firebase/auth'
import { buildMentellEmailDeepLink, getMergedUrlParams } from '../../shared/firebase/emailLinkHandoff'
import { getEmailLinkContinueUrl, getHostedEmailLinkContinueUrl } from '../../shared/firebase/nativeAuthConfig'
import { createGoogleAuthUri } from '../../shared/firebase/firebaseCreateAuthUri'
import { getFirebaseAuth } from '../../shared/firebase/firebaseApp'
import { getFirebaseWebConfig } from '../../shared/firebase/config'
import {
  localhostContinueUrl,
  startAuthCallbackServer,
  stopAuthCallbackServer,
  waitForAuthCallback,
} from '../../shared/firebase/tauriAuthCallback'
import { isFirebaseEnabled, shouldUseDebugAuthProvider } from '../../shared/features/featureFlags'
import { isDebugMode } from '../../shared/debug/debugFlags'
import { isFileProtocol, isOfflineZipBuild, isTauri } from '../../shared/platform/runtime'

export type AuthDebugSnapshot = {
  isTauri: boolean
  apiIsTauri: boolean
  viteTauri: boolean
  isDebugMode: boolean
  firebaseEnabled: boolean
  usesDebugAuthProvider: boolean
  protocol: string
  origin: string
  offlineZip: boolean
  fileProtocol: boolean
  hostedContinueUrl: string
  webContinueUrl: string
  hasOobCode: boolean
  deepLinkSample: string
}

export function getAuthDebugSnapshot(): AuthDebugSnapshot {
  const href =
    typeof window !== 'undefined'
      ? window.location.href
      : 'https://projects.slt.ong/mentell/settings?oobCode=TEST&mode=signIn&apiKey=test'
  const params = typeof window !== 'undefined' ? getMergedUrlParams() : new URLSearchParams()

  return {
    isTauri: isTauri(),
    apiIsTauri: typeof window !== 'undefined' ? apiIsTauri() : false,
    viteTauri: import.meta.env.VITE_TAURI === '1',
    isDebugMode: isDebugMode(),
    firebaseEnabled: isFirebaseEnabled(),
    usesDebugAuthProvider: shouldUseDebugAuthProvider(),
    protocol: typeof window !== 'undefined' ? window.location.protocol : '',
    origin: typeof window !== 'undefined' ? window.location.origin : '',
    offlineZip: isOfflineZipBuild(),
    fileProtocol: isFileProtocol(),
    hostedContinueUrl: getHostedEmailLinkContinueUrl(),
    webContinueUrl: getEmailLinkContinueUrl(),
    hasOobCode: params.has('oobCode') && params.get('mode') === 'signIn',
    deepLinkSample: buildMentellEmailDeepLink(href),
  }
}

export async function debugTestAuthCallbackServer(): Promise<string> {
  const port = await startAuthCallbackServer()
  return `Callback server listening on ${localhostContinueUrl(port)}`
}

export async function debugStopAuthCallbackServer(): Promise<string> {
  await stopAuthCallbackServer()
  return 'Callback server stopped'
}

export async function debugWaitForAuthCallbackOnce(
  port: number,
  timeoutMs = 120_000,
): Promise<string> {
  const url = await waitForAuthCallback(port, timeoutMs)
  return url
}

export async function debugProbeCreateAuthUri(port: number): Promise<string> {
  const uri = await createGoogleAuthUri(localhostContinueUrl(port))
  return uri.length > 120 ? `${uri.slice(0, 120)}…` : uri
}

export function debugParseEmailLink(url: string): string {
  const auth = getFirebaseAuth()
  if (!auth) return 'Firebase auth not initialized'
  return isSignInWithEmailLink(auth, url) ? 'valid email sign-in link' : 'not a valid email sign-in link'
}

export function debugFirebaseConfigSummary(): string {
  const config = getFirebaseWebConfig()
  if (!config) return 'Firebase config missing'
  return `project=${config.projectId} authDomain=${config.authDomain}`
}

import { GoogleAuthProvider, signInWithCredential, type Auth } from 'firebase/auth'
import { openUrl } from '@tauri-apps/plugin-opener'
import { createGoogleAuthUri } from './firebaseCreateAuthUri'
import {
  localhostContinueUrl,
  AUTH_CALLBACK_PORT,
  startAuthCallbackServer,
  waitForAuthCallback,
} from './tauriAuthCallback'

function parseOAuthRedirect(url: string): { accessToken: string | null; idToken: string | null } {
  const parsed = new URL(url)
  const fromHash = new URLSearchParams(parsed.hash.replace(/^#/, ''))
  const fromQuery = parsed.searchParams
  const accessToken =
    fromHash.get('access_token') ?? fromQuery.get('access_token')
  const idToken = fromHash.get('id_token') ?? fromQuery.get('id_token')
  return { accessToken, idToken }
}

/**
 * Google sign-in for Tauri: Firebase createAuthUri + localhost callback server.
 * Requires `127.0.0.1` and `localhost` in Firebase Authorized domains.
 */
export async function signInWithGoogleViaTauri(auth: Auth): Promise<void> {
  await startAuthCallbackServer()
  const continueUri = localhostContinueUrl(AUTH_CALLBACK_PORT)
  const authUri = await createGoogleAuthUri(continueUri)

  const callbackPromise = waitForAuthCallback(AUTH_CALLBACK_PORT)
  await openUrl(authUri)

  const callbackUrl = await callbackPromise
  const { accessToken, idToken } = parseOAuthRedirect(callbackUrl)
  if (!accessToken && !idToken) {
    throw new Error('Google sign-in did not return credentials. Try again.')
  }

  const credential = GoogleAuthProvider.credential(idToken, accessToken)
  await signInWithCredential(auth, credential)
}

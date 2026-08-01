import { GoogleAuthProvider, signInWithCredential, type Auth } from 'firebase/auth'
import { cancel, onUrl, start } from '@fabianlars/tauri-plugin-oauth'
import { openUrl } from '@tauri-apps/plugin-opener'
import { createGoogleAuthUri } from './firebaseCreateAuthUri'

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
 * Google sign-in for Tauri: Firebase createAuthUri + system browser + localhost capture.
 * Requires `127.0.0.1` and `localhost` in Firebase Authorized domains.
 */
export async function signInWithGoogleViaTauri(auth: Auth): Promise<void> {
  const port = await start()
  const continueUri = `http://127.0.0.1:${port}`
  const authUri = await createGoogleAuthUri(continueUri)

  return new Promise<void>((resolve, reject) => {
    let settled = false
    let unlisten: (() => void) | undefined

    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      unlisten?.()
      fn()
    }

    void onUrl((callbackUrl) => {
      void (async () => {
        const { accessToken, idToken } = parseOAuthRedirect(callbackUrl)
        if (!accessToken && !idToken) return
        await cancel(port).catch(() => undefined)
        const credential = GoogleAuthProvider.credential(idToken, accessToken)
        await signInWithCredential(auth, credential)
        finish(() => resolve())
      })().catch((error) => {
        void cancel(port).catch(() => undefined)
        finish(() => reject(error))
      })
    })
      .then((removeListener) => {
        unlisten = removeListener
        return openUrl(authUri)
      })
      .catch((error) => {
        void cancel(port).catch(() => undefined)
        finish(() => reject(error))
      })
  })
}

import { GoogleAuthProvider, signInWithCredential, type Auth } from 'firebase/auth'
import { cancel, onUrl, start } from '@fabianlars/tauri-plugin-oauth'
import { openUrl } from '@tauri-apps/plugin-opener'
import { getGoogleOAuthClientId } from './nativeAuthConfig'

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
 * Google sign-in for Tauri: system browser + localhost OAuth capture.
 * Requires `VITE_GOOGLE_OAUTH_CLIENT_ID` and `http://127.0.0.1` in Google OAuth redirect URIs.
 */
export async function signInWithGoogleViaTauri(auth: Auth): Promise<void> {
  const clientId = getGoogleOAuthClientId()
  if (!clientId) {
    throw new Error(
      'Google sign-in is not configured for the desktop app. Set VITE_GOOGLE_OAUTH_CLIENT_ID (Web client ID) and add http://127.0.0.1 to Google OAuth redirect URIs.',
    )
  }

  const port = await start()
  const redirectUri = `http://127.0.0.1:${port}`

  return new Promise<void>((resolve, reject) => {
    let settled = false
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
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
      .then((unlisten) => {
        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
        authUrl.searchParams.set('client_id', clientId)
        authUrl.searchParams.set('redirect_uri', redirectUri)
        authUrl.searchParams.set('response_type', 'token id_token')
        authUrl.searchParams.set('scope', 'openid email profile')
        authUrl.searchParams.set('nonce', crypto.randomUUID())
        authUrl.searchParams.set('prompt', 'select_account')

        void openUrl(authUrl.toString()).catch((error) => {
          unlisten()
          void cancel(port).catch(() => undefined)
          finish(() => reject(error))
        })
      })
      .catch((error) => {
        void cancel(port).catch(() => undefined)
        finish(() => reject(error))
      })
  })
}

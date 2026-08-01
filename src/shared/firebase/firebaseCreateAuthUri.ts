import { getFirebaseWebConfig } from './config'

type CreateAuthUriResponse = {
  authUri?: string
  error?: { message?: string }
}

/** Firebase-managed Google OAuth URL (no separate Web client ID env var). */
export async function createGoogleAuthUri(continueUri: string): Promise<string> {
  const config = getFirebaseWebConfig()
  if (!config?.apiKey) {
    throw new Error('Cloud sign-in is not configured')
  }

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${encodeURIComponent(config.apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providerId: 'google.com',
        continueUri,
      }),
    },
  )

  const body = (await res.json()) as CreateAuthUriResponse
  if (!res.ok || !body.authUri) {
    throw new Error(
      body.error?.message ??
        'Could not start Google sign-in. Add 127.0.0.1 and localhost to Firebase Authorized domains.',
    )
  }

  return body.authUri
}

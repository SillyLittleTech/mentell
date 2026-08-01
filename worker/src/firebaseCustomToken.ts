import { SignJWT, importPKCS8 } from 'jose'

type ServiceAccount = {
  project_id: string
  client_email: string
  private_key: string
}

export function parseFirebaseServiceAccount(raw: string): ServiceAccount {
  const sa = JSON.parse(raw) as ServiceAccount
  if (!sa.project_id || !sa.client_email || !sa.private_key) {
    throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT_JSON')
  }
  return sa
}

/** Mint a Firebase custom token for `uid` (requires service account with Auth Admin). */
export async function createFirebaseCustomToken(sa: ServiceAccount, uid: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const key = await importPKCS8(sa.private_key.replace(/\\n/g, '\n'), 'RS256')
  return new SignJWT({ uid })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience('https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key)
}

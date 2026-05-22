import { createRemoteJWKSet, jwtVerify } from 'jose'

const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
)

export async function verifyFirebaseIdToken(idToken: string, projectId: string) {
  const { payload } = await jwtVerify(idToken, FIREBASE_JWKS, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  })
  const uid = typeof payload.sub === 'string' ? payload.sub : ''
  if (!uid) throw new Error('Invalid token subject')
  return { uid }
}

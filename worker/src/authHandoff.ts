import { corsJsonHandoff, corsResponseHandoff } from './cors'
import type { Env } from './env'
import { verifyFirebaseIdToken } from './firebaseAuth'
import { createFirebaseCustomToken, parseFirebaseServiceAccount } from './firebaseCustomToken'

const CODE_TTL_SEC = 600
const CODE_PREFIX = 'auth-handoff:'
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

type HandoffRecord = {
  uid: string
  email?: string
  createdAt: number
}

function generateHandoffCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join('')
}

function normalizeCode(raw: unknown) {
  if (typeof raw !== 'string') return ''
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

async function enforceRateLimit(env: Env, key: string, limit: number, windowSec: number) {
  const bucket = Math.floor(Date.now() / (windowSec * 1000))
  const kvKey = `auth-handoff-rate:${key}:${bucket}`
  const current = Number((await env.RATE_LIMIT_KV.get(kvKey)) ?? 0)
  if (current >= limit) return false
  await env.RATE_LIMIT_KV.put(kvKey, String(current + 1), { expirationTtl: windowSec + 60 })
  return true
}

function requireServiceAccount(env: Env) {
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    throw new Error('Auth handoff is not configured on the server')
  }
  return parseFirebaseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT_JSON)
}

export async function handleAuthHandoffCreate(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin')

  if (request.method === 'OPTIONS') {
    return corsResponseHandoff(null, 204, env, origin)
  }
  if (request.method !== 'POST') {
    return corsJsonHandoff({ error: 'Method not allowed' }, 405, env, origin)
  }

  let sa
  try {
    sa = requireServiceAccount(env)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Auth handoff unavailable'
    return corsJsonHandoff({ error: message }, 503, env, origin)
  }

  const header = request.headers.get('Authorization') ?? ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  if (!match) {
    return corsJsonHandoff({ error: 'Missing Firebase ID token' }, 401, env, origin)
  }

  let uid: string
  try {
    ;({ uid } = await verifyFirebaseIdToken(match[1], sa.project_id))
  } catch {
    return corsJsonHandoff({ error: 'Invalid Firebase ID token' }, 401, env, origin)
  }

  const allowed = await enforceRateLimit(env, `create:${uid}`, 8, 3600)
  if (!allowed) {
    return corsJsonHandoff({ error: 'Too many link codes created. Try again later.' }, 429, env, origin)
  }

  const code = generateHandoffCode()
  const record: HandoffRecord = { uid, createdAt: Date.now() }
  await env.RATE_LIMIT_KV.put(`${CODE_PREFIX}${code}`, JSON.stringify(record), {
    expirationTtl: CODE_TTL_SEC,
  })

  return corsJsonHandoff(
    {
      code,
      expiresInSec: CODE_TTL_SEC,
      expiresAt: Date.now() + CODE_TTL_SEC * 1000,
    },
    200,
    env,
    origin,
  )
}

export async function handleAuthHandoffRedeem(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin')

  if (request.method === 'OPTIONS') {
    return corsResponseHandoff(null, 204, env, origin)
  }
  if (request.method !== 'POST') {
    return corsJsonHandoff({ error: 'Method not allowed' }, 405, env, origin)
  }

  let sa
  try {
    sa = requireServiceAccount(env)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Auth handoff unavailable'
    return corsJsonHandoff({ error: message }, 503, env, origin)
  }

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  const allowed = await enforceRateLimit(env, `redeem:${ip}`, 20, 3600)
  if (!allowed) {
    return corsJsonHandoff({ error: 'Too many attempts. Try again later.' }, 429, env, origin)
  }

  let body: { code?: string }
  try {
    body = (await request.json()) as { code?: string }
  } catch {
    return corsJsonHandoff({ error: 'Invalid JSON body' }, 400, env, origin)
  }

  const code = normalizeCode(body.code)
  if (code.length < 6) {
    return corsJsonHandoff({ error: 'Enter the link code from the web app' }, 400, env, origin)
  }

  const kvKey = `${CODE_PREFIX}${code}`
  const raw = await env.RATE_LIMIT_KV.get(kvKey)
  if (!raw) {
    return corsJsonHandoff({ error: 'Invalid or expired link code' }, 404, env, origin)
  }

  await env.RATE_LIMIT_KV.delete(kvKey)

  let record: HandoffRecord
  try {
    record = JSON.parse(raw) as HandoffRecord
    if (!record.uid) throw new Error('bad record')
  } catch {
    return corsJsonHandoff({ error: 'Invalid handoff record' }, 500, env, origin)
  }

  try {
    const customToken = await createFirebaseCustomToken(sa, record.uid)
    return corsJsonHandoff({ customToken }, 200, env, origin)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create sign-in token'
    return corsJsonHandoff({ error: message }, 500, env, origin)
  }
}

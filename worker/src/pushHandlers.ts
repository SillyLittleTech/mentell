import { corsJson, corsResponse } from './cors'
import { verifyFirebaseIdToken } from './firebaseAuth'
import { firebaseProjectId } from './firestoreAdmin'
import { configureWebPush, sendWebPush } from './pushSend'
import type { PushEnv } from './env'
import type { PushSubscriber, SubscribeBody, UnsubscribeBody } from './pushTypes'

const DEFAULT_DELIVERY_WEEKDAY = 1
const DEFAULT_DELIVERY_TIME = '09:00'
const FALLBACK_TZ = 'America/New_York'

function normalizeToken(raw: string) {
  const t = raw.trim()
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1)
  }
  return t
}

function bearerToken(request: Request) {
  const header = request.headers.get('Authorization') ?? ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() ?? ''
}

async function authorizeSubscribe(
  request: Request,
  env: PushEnv,
): Promise<{ uid?: string } | null> {
  const token = bearerToken(request)
  if (!token) return null
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const projectId = firebaseProjectId(env.FIREBASE_SERVICE_ACCOUNT_JSON)
      const { uid } = await verifyFirebaseIdToken(token, projectId)
      return { uid }
    } catch {
      /* fall through to shared token */
    }
  }
  if (token === normalizeToken(env.WEEKLY_SUMMARY_TOKEN)) return {}
  return null
}

function authorizeSharedToken(request: Request, env: PushEnv) {
  const token = bearerToken(request)
  return token === normalizeToken(env.WEEKLY_SUMMARY_TOKEN)
}

function subscriberKey(uid: string | undefined, clientId: string | undefined) {
  if (uid) return `sub:${uid}`
  if (clientId) return `sub:cid:${clientId}`
  return null
}

function sanitizeWeekday(raw: number | undefined) {
  const n = Number(raw)
  if (!Number.isFinite(n)) return DEFAULT_DELIVERY_WEEKDAY
  return Math.min(6, Math.max(0, Math.trunc(n)))
}

function sanitizeTime(raw: string | undefined) {
  const m = (raw ?? DEFAULT_DELIVERY_TIME).trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return DEFAULT_DELIVERY_TIME
  const h = Math.min(23, Math.max(0, Number(m[1])))
  const min = Math.min(59, Math.max(0, Number(m[2])))
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function sanitizeTimezone(raw: string | undefined) {
  const tz = (raw ?? FALLBACK_TZ).trim()
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return tz
  } catch {
    return FALLBACK_TZ
  }
}

export async function handlePushSubscribe(request: Request, env: PushEnv) {
  const origin = request.headers.get('Origin')
  if (request.method === 'OPTIONS') return corsResponse(null, 204, env, origin)

  if (request.method !== 'POST') {
    return corsJson({ error: 'Method not allowed' }, 405, env, origin)
  }

  let body: SubscribeBody
  try {
    body = (await request.json()) as SubscribeBody
  } catch {
    return corsJson({ error: 'Invalid JSON' }, 400, env, origin)
  }

  const sub = body.subscription
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return corsJson({ error: 'subscription with keys is required' }, 400, env, origin)
  }

  const auth = await authorizeSubscribe(request, env)
  if (!auth) return corsJson({ error: 'Unauthorized' }, 401, env, origin)
  const uid = auth.uid
  const clientId = body.clientId?.trim()
  const key = subscriberKey(uid, clientId)
  if (!key) return corsJson({ error: 'clientId required when not signed in' }, 400, env, origin)

  const record: PushSubscriber = {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    uid,
    clientId,
    disableNotifications: Boolean(body.disableNotifications),
    deliveryWeekday: sanitizeWeekday(body.deliveryWeekday),
    deliveryTimeLocal: sanitizeTime(body.deliveryTimeLocal),
    timezone: sanitizeTimezone(body.timezone),
    updatedAt: Date.now(),
  }

  await env.PUSH_KV.put(key, JSON.stringify(record))
  await env.PUSH_KV.put(`ep:${await hashEndpoint(sub.endpoint)}`, key)

  return corsJson({ ok: true }, 200, env, origin)
}

export async function handlePushUnsubscribe(request: Request, env: PushEnv) {
  const origin = request.headers.get('Origin')
  if (request.method === 'OPTIONS') return corsResponse(null, 204, env, origin)
  if (request.method !== 'POST') {
    return corsJson({ error: 'Method not allowed' }, 405, env, origin)
  }

  let body: UnsubscribeBody
  try {
    body = (await request.json()) as UnsubscribeBody
  } catch {
    return corsJson({ error: 'Invalid JSON' }, 400, env, origin)
  }

  const auth = await authorizeSubscribe(request, env)
  if (!auth) return corsJson({ error: 'Unauthorized' }, 401, env, origin)
  const uid = auth.uid
  const clientId = body.clientId?.trim()
  const key = subscriberKey(uid, clientId)
  if (!key) return corsJson({ error: 'clientId required when not signed in' }, 400, env, origin)

  if (body.endpoint) {
    const epKey = `ep:${await hashEndpoint(body.endpoint)}`
    const mapped = await env.PUSH_KV.get(epKey)
    if (mapped) await env.PUSH_KV.delete(mapped)
    await env.PUSH_KV.delete(epKey)
  }
  await env.PUSH_KV.delete(key)

  return corsJson({ ok: true }, 200, env, origin)
}

function vapidConfigured(env: PushEnv) {
  return Boolean(env.VAPID_PUBLIC_KEY?.trim() && env.VAPID_PRIVATE_KEY?.trim())
}

function vapidNotConfiguredResponse(env: PushEnv, origin: string | null) {
  return corsJson(
    {
      error: 'VAPID keys not configured',
      hint: 'Local dev: copy worker/.dev.vars.example → worker/.dev.vars and set VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY, then restart wrangler dev.',
    },
    500,
    env,
    origin,
  )
}

export async function handlePushStatus(request: Request, env: PushEnv) {
  const origin = request.headers.get('Origin')
  if (request.method === 'OPTIONS') return corsResponse(null, 204, env, origin)
  if (request.method !== 'GET') {
    return corsJson({ error: 'Method not allowed' }, 405, env, origin)
  }
  return corsJson({ vapidConfigured: vapidConfigured(env) }, 200, env, origin)
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export async function handlePushTestDelayed(
  request: Request,
  env: PushEnv,
  ctx: ExecutionContext,
) {
  const origin = request.headers.get('Origin')
  if (request.method === 'OPTIONS') return corsResponse(null, 204, env, origin)
  if (request.method !== 'POST') {
    return corsJson({ error: 'Method not allowed' }, 405, env, origin)
  }
  if (!authorizeSharedToken(request, env)) {
    return corsJson({ error: 'Unauthorized' }, 401, env, origin)
  }
  if (!vapidConfigured(env)) {
    return vapidNotConfiguredResponse(env, origin)
  }

  let body: {
    endpoint?: string
    keys?: { p256dh: string; auth: string }
    delaySeconds?: number
    title?: string
    body?: string
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return corsJson({ error: 'Invalid JSON' }, 400, env, origin)
  }
  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return corsJson({ error: 'endpoint and keys required' }, 400, env, origin)
  }

  const delaySeconds = Math.min(120, Math.max(3, Math.trunc(body.delaySeconds ?? 30)))
  const title = body.title?.trim() || 'Mentell (delayed)'
  const pushBody =
    body.body?.trim() ||
    `Delayed push after ${delaySeconds}s — you can close this tab or switch apps.`

  configureWebPush(env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!)
  const subscription = {
    endpoint: body.endpoint,
    keys: body.keys,
  }

  ctx.waitUntil(
    (async () => {
      await sleep(delaySeconds * 1000)
      await sendWebPush(subscription, { title, body: pushBody })
    })(),
  )

  return corsJson({ ok: true, scheduledInSeconds: delaySeconds }, 202, env, origin)
}

export async function handlePushTest(request: Request, env: PushEnv) {
  const origin = request.headers.get('Origin')
  if (request.method === 'OPTIONS') return corsResponse(null, 204, env, origin)
  if (request.method !== 'POST') {
    return corsJson({ error: 'Method not allowed' }, 405, env, origin)
  }
  if (!authorizeSharedToken(request, env)) {
    return corsJson({ error: 'Unauthorized' }, 401, env, origin)
  }
  if (!vapidConfigured(env)) {
    return vapidNotConfiguredResponse(env, origin)
  }

  let body: { endpoint?: string; keys?: { p256dh: string; auth: string } }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return corsJson({ error: 'Invalid JSON' }, 400, env, origin)
  }
  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return corsJson({ error: 'endpoint and keys required' }, 400, env, origin)
  }

  configureWebPush(env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!)
  await sendWebPush(
    { endpoint: body.endpoint, keys: body.keys },
    { title: 'Mentell test', body: 'Push delivery is working.' },
  )
  return corsJson({ ok: true }, 200, env, origin)
}

async function hashEndpoint(endpoint: string) {
  const data = new TextEncoder().encode(endpoint)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

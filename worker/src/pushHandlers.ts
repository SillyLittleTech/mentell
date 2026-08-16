import { corsJson, corsResponse } from './cors'
import { verifyFirebaseIdToken } from './firebaseAuth'
import { firebaseProjectId } from './firestoreAdmin'
import { configureWebPush, sendWebPush } from './pushSend'
import type { PushEnv } from './env'
import type { PushSubscriber, SubscribeBody, UnsubscribeBody } from './pushTypes'

const DEFAULT_DELIVERY_WEEKDAY = 1
const DEFAULT_DELIVERY_TIME = '09:00'
const FALLBACK_TZ = 'America/New_York'
const PUSH_HOUR_LIMIT = 60
const PUSH_DAY_LIMIT = 180

export function normalizeToken(raw?: string) {
  if (!raw) return ''
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

export async function authorizeSubscribe(
  request: Request,
  env: PushEnv,
): Promise<{ uid?: string; email?: string } | null> {
  const token = bearerToken(request)
  if (!token) return null
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const projectId = firebaseProjectId(env.FIREBASE_SERVICE_ACCOUNT_JSON)
      const { uid, email } = await verifyFirebaseIdToken(token, projectId)
      return { uid, email }
    } catch {
      /* fall through to shared token */
    }
  }
  if (token === normalizeToken(env.WEEKLY_SUMMARY_TOKEN)) return {}
  return null
}

export function authorizeSharedToken(request: Request, env: PushEnv) {
  const token = bearerToken(request)
  return token === normalizeToken(env.WEEKLY_SUMMARY_TOKEN)
}

function subscriberKey(uid: string | undefined, clientId: string | undefined) {
  if (uid && clientId) return `sub:${uid}:${clientId}`
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
  const limited = await enforcePushRateLimit(env, clientIp(request), 'subscribe')
  if (!limited.ok) return corsJson({ error: limited.reason }, 429, env, origin)

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

  const previousRaw = await env.PUSH_KV.get(key)
  const previous = parseSubscriber(previousRaw)

  await env.PUSH_KV.put(key, JSON.stringify(record))
  await env.PUSH_KV.put(`ep:${await hashEndpoint(sub.endpoint)}`, key)
  if (previous?.endpoint && previous.endpoint !== sub.endpoint) {
    await env.PUSH_KV.delete(`ep:${await hashEndpoint(previous.endpoint)}`)
  }
  // Promote anonymous client records once the user signs in so cron does not
  // send twice (or at Eastern Time) for the same endpoint.
  if (uid && clientId) {
    const anonKey = `sub:cid:${clientId}`
    if (anonKey !== key) await env.PUSH_KV.delete(anonKey)
  }

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
  const limited = await enforcePushRateLimit(env, clientIp(request), 'unsubscribe')
  if (!limited.ok) return corsJson({ error: limited.reason }, 429, env, origin)

  if (body.endpoint) {
    const epKey = `ep:${await hashEndpoint(body.endpoint)}`
    const mapped = await env.PUSH_KV.get(epKey)
    if (mapped === key) {
      await env.PUSH_KV.delete(mapped)
      await env.PUSH_KV.delete(epKey)
    }
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
  if (request.method === 'OPTIONS') return corsResponse(null, 204, env, origin, 'GET, OPTIONS')
  if (request.method !== 'GET') {
    return corsJson({ error: 'Method not allowed' }, 405, env, origin, 'GET, OPTIONS')
  }
  return corsJson({ vapidConfigured: vapidConfigured(env) }, 200, env, origin, 'GET, OPTIONS')
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
  const limited = await enforcePushRateLimit(env, clientIp(request), 'test-delayed')
  if (!limited.ok) return corsJson({ error: limited.reason }, 429, env, origin)
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
  const limited = await enforcePushRateLimit(env, clientIp(request), 'test')
  if (!limited.ok) return corsJson({ error: limited.reason }, 429, env, origin)
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

function clientIp(request: Request) {
  return (
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown'
  )
}

async function enforcePushRateLimit(env: PushEnv, ip: string, route: string) {
  const now = Date.now()
  const hourKey = `push:h:${route}:${ip}:${Math.floor(now / (60 * 60 * 1000))}`
  const dayKey = `push:d:${route}:${ip}:${Math.floor(now / (24 * 60 * 60 * 1000))}`
  const hourCount = await incrementRate(env.RATE_LIMIT_KV, hourKey)
  if (hourCount > PUSH_HOUR_LIMIT) {
    return { ok: false as const, reason: `Hourly limit reached (${PUSH_HOUR_LIMIT}/hour).` }
  }
  const dayCount = await incrementRate(env.RATE_LIMIT_KV, dayKey)
  if (dayCount > PUSH_DAY_LIMIT) {
    return { ok: false as const, reason: `Daily limit reached (${PUSH_DAY_LIMIT}/day).` }
  }
  return { ok: true as const }
}

async function incrementRate(kv: KVNamespace, key: string) {
  const raw = await kv.get(key)
  const next = (raw ? Number(raw) : 0) + 1
  await kv.put(key, String(next), { expirationTtl: 60 * 60 * 48 })
  return next
}

function parseSubscriber(raw: string | null) {
  if (!raw) return null
  try {
    return JSON.parse(raw) as PushSubscriber
  } catch {
    return null
  }
}

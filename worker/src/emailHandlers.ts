import { corsJson, corsResponse } from './cors'
import type { Env } from './env'
import type { EmailSubscriberRecord, SubscribeEmailBody } from './emailTypes'
import { sendResendEmail } from './emailSend'
import { authorizeSubscribe } from './pushHandlers'

function isValidEmail(email: string) {
  return (
    email.length > 0 &&
    email.length <= 254 &&
    email.indexOf('@') >= 1 &&
    email.indexOf('@') === email.lastIndexOf('@') &&
    email.indexOf('.') >= email.indexOf('@') + 2
  )
}

function publicAppBase(env: Env, request: Request) {
  const configured = env.MENTELL_PUBLIC_URL?.trim().replace(/\/$/, '')
  if (configured) return configured

  const origin = request.headers.get('Origin')
  if (!origin || origin === 'null') return 'https://projects.slt.ong/mentell'
  try {
    const url = new URL(origin)
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return origin
    if (url.hostname === 'projects.slt.ong') return `${origin}/mentell`
    return origin
  } catch {
    return 'https://projects.slt.ong/mentell'
  }
}

function subscriberUserId(uid: string | undefined, clientId: string | undefined) {
  if (uid) return uid
  const cid = clientId?.trim()
  if (cid) return `anon_${cid}`
  return `anon_${crypto.randomUUID()}`
}

export async function handleEmailSubscribe(request: Request, env: Env) {
  const origin = request.headers.get('Origin')
  if (request.method === 'OPTIONS') return corsResponse(null, 204, env, origin)

  if (request.method !== 'POST') {
    return corsJson({ error: 'Method not allowed' }, 405, env, origin)
  }

  let body: SubscribeEmailBody
  try {
    body = (await request.json()) as SubscribeEmailBody
  } catch {
    return corsJson({ error: 'Invalid JSON' }, 400, env, origin)
  }

  const email = typeof body.email === 'string' ? body.email.trim() : ''
  if (!isValidEmail(email)) {
    return corsJson({ error: 'Valid email required' }, 400, env, origin)
  }

  const auth = await authorizeSubscribe(request, env)
  if (!auth) {
    return corsJson(
      { error: 'Unauthorized: sign in or send the shared worker API token' },
      401,
      env,
      origin,
    )
  }

  const userId = subscriberUserId(auth.uid, body.clientId)
  const key = `email_sub:${userId}`

  const previousRaw = await env.PUSH_KV.get(key)
  let existing: EmailSubscriberRecord | null = null
  if (previousRaw) {
    try {
      existing = JSON.parse(previousRaw) as EmailSubscriberRecord
    } catch {
      /* ignore */
    }
  }

  const emailChanged = existing?.email !== email
  const autoVerified = Boolean(auth.email && auth.email.toLowerCase() === email.toLowerCase())

  const record: EmailSubscriberRecord = {
    userId,
    email,
    verified: existing && !emailChanged ? existing.verified : autoVerified,
    createdAt: existing?.createdAt || Date.now(),
    preferences: {
      dailyReminderEnabled: Boolean(body.dailyReminderEnabled),
      dailyReminderHours: typeof body.dailyReminderHours === 'number' ? body.dailyReminderHours : 1,
      weeklyPackageDropEnabled: Boolean(body.weeklyPackageDropEnabled),
      timezone: body.timezone || 'America/New_York',
      globalName: body.globalName,
      disableAi: Boolean(body.disableAi),
    },
    lastSent: existing?.lastSent || {},
  }

  let emailSent = record.verified
  let emailError: string | undefined

  if (!record.verified) {
    const verifyToken = crypto.randomUUID()
    record.verifyToken = verifyToken
    const verifyUrl = `${publicAppBase(env, request)}/verify?token=${encodeURIComponent(verifyToken)}`

    await env.PUSH_KV.put(
      `verify_token:${verifyToken}`,
      JSON.stringify({
        userId,
        email,
        expiresAt: Date.now() + 1000 * 60 * 60 * 24,
      }),
      { expirationTtl: 60 * 60 * 24 },
    )

    await env.PUSH_KV.put(key, JSON.stringify(record))

    const sent = await sendResendEmail(env, 'verify', email, {
      verify_token: verifyToken,
      verify_url: verifyUrl,
      global_name: body.globalName?.trim() || '',
    })
    emailSent = sent.ok
    if (!sent.ok) emailError = sent.error
  } else {
    await env.PUSH_KV.put(key, JSON.stringify(record))
  }

  return corsJson(
    {
      ok: true,
      userId,
      verified: record.verified,
      emailSent,
      ...(emailError ? { emailError } : {}),
    },
    200,
    env,
    origin,
  )
}

export async function handleEmailUnsubscribe(request: Request, env: Env) {
  const origin = request.headers.get('Origin')
  if (request.method === 'OPTIONS') return corsResponse(null, 204, env, origin)

  if (request.method !== 'POST') {
    return corsJson({ error: 'Method not allowed' }, 405, env, origin)
  }

  const auth = await authorizeSubscribe(request, env)
  if (!auth) {
    return corsJson({ error: 'Unauthorized' }, 401, env, origin)
  }

  let body: { clientId?: string } = {}
  try {
    body = (await request.json()) as { clientId?: string }
  } catch {
    /* empty body is fine */
  }

  const userId = subscriberUserId(auth.uid, body.clientId)
  const key = `email_sub:${userId}`
  const raw = await env.PUSH_KV.get(key)
  if (!raw) {
    return corsJson({ ok: true, userId, existed: false }, 200, env, origin)
  }

  try {
    const sub = JSON.parse(raw) as EmailSubscriberRecord
    if (sub.verifyToken) {
      await env.PUSH_KV.delete(`verify_token:${sub.verifyToken}`)
      await env.PUSH_KV.delete(`verify_token_used:${sub.verifyToken}`)
    }
    await env.PUSH_KV.delete(key)
  } catch {
    await env.PUSH_KV.delete(key)
  }

  return corsJson({ ok: true, userId, existed: true }, 200, env, origin)
}

export async function handleEmailUnverify(request: Request, env: Env) {
  const origin = request.headers.get('Origin')
  if (request.method === 'OPTIONS') return corsResponse(null, 204, env, origin)

  if (request.method !== 'POST') {
    return corsJson({ error: 'Method not allowed' }, 405, env, origin)
  }

  const auth = await authorizeSubscribe(request, env)
  if (!auth) {
    return corsJson({ error: 'Unauthorized' }, 401, env, origin)
  }

  let body: { clientId?: string } = {}
  try {
    body = (await request.json()) as { clientId?: string }
  } catch {
    /* empty body is fine */
  }

  const userId = subscriberUserId(auth.uid, body.clientId)
  const key = `email_sub:${userId}`
  const raw = await env.PUSH_KV.get(key)
  if (!raw) {
    return corsJson({ ok: true, userId, existed: false }, 200, env, origin)
  }

  try {
    const sub = JSON.parse(raw) as EmailSubscriberRecord
    if (sub.verifyToken) {
      await env.PUSH_KV.delete(`verify_token:${sub.verifyToken}`)
      await env.PUSH_KV.delete(`verify_token_used:${sub.verifyToken}`)
    }
    sub.verified = false
    delete sub.verifyToken
    await env.PUSH_KV.put(key, JSON.stringify(sub))
  } catch {
    return corsJson({ error: 'Invalid subscriber record' }, 500, env, origin)
  }

  return corsJson({ ok: true, userId, existed: true }, 200, env, origin)
}

function stripWrappingQuotes(value: string) {
  let out = value
  while (out.length > 0 && (out.startsWith('"') || out.startsWith("'"))) {
    out = out.slice(1)
  }
  while (out.length > 0 && (out.endsWith('"') || out.endsWith("'"))) {
    out = out.slice(0, -1)
  }
  return out
}

function sanitizeVerifyToken(raw: string | null) {
  if (!raw) return ''
  const trimmed = stripWrappingQuotes(raw.trim())
  const cut = trimmed.search(/[&\s<>]/)
  return (cut === -1 ? trimmed : trimmed.slice(0, cut)).trim()
}

export async function handleEmailVerify(request: Request, env: Env) {
  const origin = request.headers.get('Origin')
  if (request.method === 'OPTIONS') return corsResponse(null, 204, env, origin, 'GET, POST, OPTIONS')

  if (request.method !== 'GET' && request.method !== 'POST') {
    return corsJson({ error: 'Method not allowed' }, 405, env, origin, 'GET, POST, OPTIONS')
  }

  const url = new URL(request.url)
  let token = sanitizeVerifyToken(url.searchParams.get('token'))
  if (!token && request.method === 'POST') {
    try {
      const body = (await request.json()) as { token?: string }
      token = sanitizeVerifyToken(typeof body.token === 'string' ? body.token : '')
    } catch {
      /* ignore */
    }
  }

  if (!token) {
    return corsJson({ error: 'Token missing' }, 400, env, origin, 'GET, POST, OPTIONS')
  }

  const usedKey = `verify_token_used:${token}`
  const tokenKey = `verify_token:${token}`
  const tokenRaw = (await env.PUSH_KV.get(tokenKey)) || (await env.PUSH_KV.get(usedKey))
  if (!tokenRaw) {
    return corsJson({ error: 'Invalid or expired token' }, 400, env, origin, 'GET, POST, OPTIONS')
  }

  let tokenData: { userId?: string; email?: string }
  try {
    tokenData = JSON.parse(tokenRaw) as { userId?: string; email?: string }
  } catch {
    return corsJson({ error: 'Invalid token data' }, 400, env, origin, 'GET, POST, OPTIONS')
  }

  const key = `email_sub:${tokenData.userId}`
  const subRaw = await env.PUSH_KV.get(key)

  if (subRaw) {
    try {
      const sub = JSON.parse(subRaw) as EmailSubscriberRecord
      if (sub.verifyToken === token || sub.email === tokenData.email || sub.verified) {
        sub.verified = true
        delete sub.verifyToken
        await env.PUSH_KV.put(key, JSON.stringify(sub))
      }
    } catch {
      /* ignore */
    }
  }

  await env.PUSH_KV.put(usedKey, tokenRaw, { expirationTtl: 60 * 60 * 24 })
  await env.PUSH_KV.delete(tokenKey)

  return corsJson({ ok: true }, 200, env, origin, 'GET, POST, OPTIONS')
}

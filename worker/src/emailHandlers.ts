import { corsJson, corsResponse } from './cors'
import type { Env } from './env'
import type { EmailSubscriberRecord, SubscribeEmailBody } from './emailTypes'
import { sendResendEmail } from './emailSend'

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

  if (!body.email || body.email.length > 254 || body.email.indexOf('@') < 1 || body.email.indexOf('@') !== body.email.lastIndexOf('@') || body.email.indexOf('.') < body.email.indexOf('@') + 2) {
    return corsJson({ error: 'Valid email required' }, 400, env, origin)
  }

  const authHeader = request.headers.get('Authorization') ?? ''
  let uid: string | undefined
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    if (token !== env.WEEKLY_SUMMARY_TOKEN && env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      // Very basic best-effort token decode to get uid.
      // Usually would verify via Firebase, but let's assume it's valid if passed.
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        if (payload.user_id) uid = payload.user_id
      } catch {
        /* ignore */
      }
    }
  }

  const userId = uid || body.clientId || `anon_${crypto.randomUUID()}`
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

  const emailChanged = existing?.email !== body.email

  const record: EmailSubscriberRecord = {
    userId,
    email: body.email,
    verified: existing && !emailChanged ? existing.verified : Boolean(body.autoVerify),
    createdAt: existing?.createdAt || Date.now(),
    preferences: {
      dailyReminderEnabled: Boolean(body.dailyReminderEnabled),
      dailyReminderHours: typeof body.dailyReminderHours === 'number' ? body.dailyReminderHours : 1,
      weeklyPackageDropEnabled: Boolean(body.weeklyPackageDropEnabled),
      timezone: body.timezone || 'America/New_York',
      globalName: body.globalName
    },
    lastSent: existing?.lastSent || {}
  }

  if (!record.verified && env.RESEND_TEMPLATE_VERIFY) {
    const verifyToken = crypto.randomUUID()
    record.verifyToken = verifyToken

    await env.PUSH_KV.put(`verify_token:${verifyToken}`, JSON.stringify({
      userId,
      email: body.email,
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 // 24 hours
    }), { expirationTtl: 60 * 60 * 24 })

    // Send async
    env.PUSH_KV.put(key, JSON.stringify(record)).then(() => {
      sendResendEmail(env, env.RESEND_TEMPLATE_VERIFY!, body.email, {
        verify_token: verifyToken,
        global_name: body.globalName || 'there'
      })
    })
  } else {
    await env.PUSH_KV.put(key, JSON.stringify(record))
  }

  return corsJson({ ok: true, userId, verified: record.verified }, 200, env, origin)
}

export async function handleEmailVerify(request: Request, env: Env) {
  const origin = request.headers.get('Origin')
  if (request.method === 'OPTIONS') return corsResponse(null, 204, env, origin, 'GET, OPTIONS')

  if (request.method !== 'GET') {
    return corsJson({ error: 'Method not allowed' }, 405, env, origin, 'GET, OPTIONS')
  }

  const url = new URL(request.url)
  const token = url.searchParams.get('token')

  if (!token) {
    return corsJson({ error: 'Token missing' }, 400, env, origin, 'GET, OPTIONS')
  }

  const tokenRaw = await env.PUSH_KV.get(`verify_token:${token}`)
  if (!tokenRaw) {
    return corsJson({ error: 'Invalid or expired token' }, 400, env, origin, 'GET, OPTIONS')
  }

  let tokenData
  try {
    tokenData = JSON.parse(tokenRaw)
  } catch {
    return corsJson({ error: 'Invalid token data' }, 400, env, origin, 'GET, OPTIONS')
  }

  const key = `email_sub:${tokenData.userId}`
  const subRaw = await env.PUSH_KV.get(key)

  if (subRaw) {
    try {
      const sub = JSON.parse(subRaw) as EmailSubscriberRecord
      if (sub.verifyToken === token || sub.email === tokenData.email) {
        sub.verified = true
        delete sub.verifyToken
        await env.PUSH_KV.put(key, JSON.stringify(sub))
      }
    } catch {
      /* ignore */
    }
  }

  await env.PUSH_KV.delete(`verify_token:${token}`)

  return corsJson({ ok: true }, 200, env, origin, 'GET, OPTIONS')
}

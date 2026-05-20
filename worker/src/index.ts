export interface Env {
  AI: Ai
  RATE_LIMIT_KV: KVNamespace
  WEEKLY_SUMMARY_TOKEN: string
  ALLOWED_ORIGIN?: string
}

type JournalEntry = {
  dateKey: string
  sentiment: string
  emotion?: string
  situation: string
  details: string
}

const HOUR_LIMIT = 24
const DAY_LIMIT = 80
const MODEL = '@cf/meta/llama-3.1-8b-instruct'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin')

    if (request.method === 'OPTIONS') {
      return corsResponse(null, 204, env, origin)
    }

    if (url.pathname !== '/weekly-summary') {
      return corsJson({ error: 'Not found' }, 404, env, origin)
    }

    if (request.method !== 'POST') {
      return corsJson({ error: 'Method not allowed' }, 405, env, origin)
    }

    if (!authorize(request, env)) {
      return corsJson({ error: 'Unauthorized' }, 401, env, origin)
    }

    let body: { entries?: JournalEntry[] }
    try {
      body = (await request.json()) as { entries?: JournalEntry[] }
    } catch {
      return corsJson({ error: 'Invalid JSON body' }, 400, env, origin)
    }

    const entries = body.entries
    if (!Array.isArray(entries) || entries.length === 0) {
      return corsJson({ error: 'entries array is required' }, 400, env, origin)
    }

    const ip = clientIp(request)
    const limited = await enforceRateLimit(env, ip)
    if (!limited.ok) {
      return corsJson({ error: limited.reason }, 429, env, origin)
    }

    try {
      const summary = await generateSummary(env, entries)
      return corsJson({ summary }, 200, env, origin)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI summary failed'
      return corsJson({ error: message }, 500, env, origin)
    }
  },
}

function authorize(request: Request, env: Env) {
  const header = request.headers.get('Authorization') ?? ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  if (!match) return false
  return match[1] === env.WEEKLY_SUMMARY_TOKEN
}

function clientIp(request: Request) {
  return (
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown'
  )
}

async function enforceRateLimit(env: Env, ip: string) {
  const now = Date.now()
  const hourKey = `h:${ip}:${Math.floor(now / (60 * 60 * 1000))}`
  const dayKey = `d:${ip}:${Math.floor(now / (24 * 60 * 60 * 1000))}`

  const hourCount = await increment(env.RATE_LIMIT_KV, hourKey)
  if (hourCount > HOUR_LIMIT) {
    return { ok: false as const, reason: `Hourly limit reached (${HOUR_LIMIT}/hour).` }
  }

  const dayCount = await increment(env.RATE_LIMIT_KV, dayKey)
  if (dayCount > DAY_LIMIT) {
    return { ok: false as const, reason: `Daily limit reached (${DAY_LIMIT}/day).` }
  }

  return { ok: true as const }
}

async function increment(kv: KVNamespace, key: string) {
  const raw = await kv.get(key)
  const next = (raw ? Number(raw) : 0) + 1
  await kv.put(key, String(next), { expirationTtl: 60 * 60 * 48 })
  return next
}

async function generateSummary(env: Env, entries: JournalEntry[]) {
  const positives = entries.filter((e) => e.sentiment === '+').length
  const negatives = entries.filter((e) => e.sentiment === '-').length
  const mixed = entries.filter((e) => e.sentiment === '=').length

  const result = await env.AI.run(MODEL, {
    messages: [
      {
        role: 'system',
        content: [
          'You summarize a week of personal mental-health journal entries.',
          'Be warm, concise, and non-judgmental.',
          'Do not diagnose, prescribe, or give medical advice.',
          'If entries mention crisis language, encourage reaching out to trusted support or local emergency services.',
          'Write 2-4 short paragraphs in plain language.',
        ].join(' '),
      },
      {
        role: 'user',
        content: JSON.stringify({
          stats: { positives, negatives, mixed, total: entries.length },
          entries: entries.map((e) => ({
            dateKey: e.dateKey,
            sentiment: e.sentiment,
            emotion: e.emotion ?? null,
            situation: e.situation,
            details: e.details,
          })),
        }),
      },
    ],
  })

  const text = extractAiText(result)
  if (!text.trim()) {
    throw new Error('Model returned an empty summary')
  }
  return text.trim()
}

function extractAiText(result: unknown) {
  if (typeof result === 'string') return result
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>
    if (typeof r.response === 'string') return r.response
    if (typeof r.text === 'string') return r.text
    const choices = r.choices
    if (Array.isArray(choices) && choices[0] && typeof choices[0] === 'object') {
      const msg = (choices[0] as { message?: { content?: string } }).message?.content
      if (typeof msg === 'string') return msg
    }
  }
  return ''
}

function corsOrigin(env: Env, requestOrigin: string | null) {
  if (env.ALLOWED_ORIGIN) return env.ALLOWED_ORIGIN
  if (requestOrigin && (requestOrigin.startsWith('http://localhost:') || requestOrigin.startsWith('http://127.0.0.1:'))) {
    return requestOrigin
  }
  return null
}

function corsHeaders(env: Env, requestOrigin: string | null) {
  const allow = corsOrigin(env, requestOrigin)
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    Vary: 'Origin',
  }
  if (allow) headers['Access-Control-Allow-Origin'] = allow
  return headers
}

function corsResponse(body: BodyInit | null, status: number, env: Env, requestOrigin: string | null) {
  return new Response(body, { status, headers: corsHeaders(env, requestOrigin) })
}

function corsJson(payload: unknown, status: number, env: Env, requestOrigin: string | null) {
  const headers = {
    ...corsHeaders(env, requestOrigin),
    'Content-Type': 'application/json',
  }
  return new Response(JSON.stringify(payload), { status, headers })
}

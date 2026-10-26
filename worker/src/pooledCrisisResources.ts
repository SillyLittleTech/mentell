import { corsJson, corsResponse } from './cors'
import type { Env } from './env'
import { extractAiText, runWorkersAi } from './aiGateway'

const RESPONSE_MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct'
const HOUR_LIMIT = 30
const DAY_LIMIT = 120

type ExistingResource = {
  name?: string
  phone?: string
}

type LocationInput = {
  countryCode?: string
  regionCode?: string
  city?: string
  county?: string
  zip?: string
}

type RequestBody = {
  location?: LocationInput
  topics?: string[]
  existing?: ExistingResource[]
}

type PooledResourceRow = {
  name: string
  descriptor: string
  hours?: string
  phone?: string
  chat?: string
  website?: string
  source: string
}

export async function handlePooledCrisisResources(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin')

  if (request.method === 'OPTIONS') {
    return corsResponse(null, 204, env, origin)
  }

  if (request.method !== 'POST') {
    return corsJson({ error: 'Method not allowed' }, 405, env, origin)
  }

  if (!authorize(request, env)) {
    return corsJson({ error: 'Unauthorized' }, 401, env, origin)
  }

  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return corsJson({ error: 'Invalid JSON body' }, 400, env, origin)
  }

  const location = body.location
  if (!location || typeof location !== 'object') {
    return corsJson({ error: 'location is required' }, 400, env, origin)
  }

  const rate = await enforceRateLimit(env, clientIp(request))
  if (!rate.ok) {
    return corsJson({ error: rate.reason }, 429, env, origin)
  }

  try {
    const resources = await suggestResourcesWithAi(env, location, body.existing ?? [], body.topics ?? [])
    return corsJson({ resources }, 200, env, origin)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Pooled resource lookup failed'
    return corsJson({ error: message }, 500, env, origin)
  }
}

function authorize(request: Request, env: Env) {
  const header = request.headers.get('Authorization') ?? ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  if (!match) return false
  return match[1] === normalizeToken(env.WEEKLY_SUMMARY_TOKEN)
}

function normalizeToken(raw: string) {
  const t = raw.trim()
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1)
  }
  return t
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
  const hourKey = `pool:h:${ip}:${Math.floor(now / (60 * 60 * 1000))}`
  const dayKey = `pool:d:${ip}:${Math.floor(now / (24 * 60 * 60 * 1000))}`

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

async function suggestResourcesWithAi(
  env: Env,
  location: LocationInput,
  existing: ExistingResource[],
  topics: string[],
) {
  const existingLines = existing
    .slice(0, 24)
    .map((row) => {
      const name = typeof row.name === 'string' ? row.name.trim() : ''
      const phone = typeof row.phone === 'string' ? row.phone.trim() : ''
      if (!name) return ''
      return phone ? `${name} (${phone})` : name
    })
    .filter(Boolean)

  const topicList = topics.length ? topics.join(', ') : 'suicide, mental_health'

  const result = await runWorkersAi(env, RESPONSE_MODEL, {
    messages: [
      {
        role: 'system',
        content: `You help people find local crisis and mental health support in the United States and internationally.
Use general public knowledge about verified helplines, hospital crisis lines, county mobile crisis teams, and community mental health centers.
Return JSON only. No markdown.
Schema: {"resources":[{"name":"string","descriptor":"string","hours":"string or empty","phone":"string or empty","chat":"https URL or empty","website":"https URL or empty","source":"string"}]}
Rules:
- Suggest up to 5 resources that plausibly serve the given area (city, county, ZIP, state/region).
- Prefer crisis lines, 24/7 psychiatric emergency, county crisis teams, and well-known regional helplines that directories often miss.
- Do NOT repeat anything in existingResources (same org, same phone, or obvious alias).
- Omit phone, chat, or website fields when unknown — use empty string, do not guess fake numbers.
- source is a short citation (e.g. "Blair County mental health services", "UPMC Altoona", "211 Pennsylvania") without URLs.
- Do not include school tip lines (Safe2Say) unless no other crisis line exists for the area.
- For immediate life-threatening emergencies, still list professional crisis lines; do not tell the user to journal.`,
      },
      {
        role: 'user',
        content: JSON.stringify({
          location: {
            countryCode: location.countryCode ?? '',
            regionCode: location.regionCode ?? '',
            city: location.city ?? '',
            county: location.county ?? '',
            zip: location.zip ?? '',
          },
          topics: topicList,
          existingResources: existingLines,
        }),
      },
    ],
    max_tokens: 900,
    temperature: 0.15,
    response_format: { type: 'json_object' },
  })

  const parsed = parseJsonObject(extractAiText(result))
  const rows = Array.isArray(parsed.resources) ? parsed.resources : []
  return sanitizeRows(rows)
}

function parseJsonObject(raw: string) {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) return {}
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return {}
  }
}

function sanitizeRows(rows: unknown[]): PooledResourceRow[] {
  const out: PooledResourceRow[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const record = row as Record<string, unknown>
    const name = typeof record.name === 'string' ? record.name.trim().slice(0, 120) : ''
    const descriptor = typeof record.descriptor === 'string' ? record.descriptor.trim().slice(0, 400) : ''
    if (!name || !descriptor) continue
    const hours = cleanOptionalString(record.hours, 80)
    const phone = cleanPhone(record.phone)
    const chat = cleanUrl(record.chat)
    const website = cleanUrl(record.website)
    const source = typeof record.source === 'string' ? record.source.trim().slice(0, 120) : 'Public reference'
    out.push({ name, descriptor, hours, phone, chat, website, source })
    if (out.length >= 5) break
  }
  return out
}

function cleanOptionalString(value: unknown, max: number) {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.slice(0, max)
}

function cleanPhone(value: unknown) {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (/^(988|211)$/.test(trimmed)) return trimmed
  const digits = trimmed.replace(/[^\d+]/g, '')
  if (digits.replace(/\D/g, '').length < 3) return undefined
  return trimmed.slice(0, 32)
}

function cleanUrl(value: unknown) {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    return url.toString().slice(0, 300)
  } catch {
    return undefined
  }
}

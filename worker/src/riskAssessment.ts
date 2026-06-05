import { corsJson, corsResponse } from './cors'
import type { Env } from './env'

type RiskLevel = 'none' | 'low' | 'elevated' | 'crisis'

type RequestBody = {
  localRiskScore?: number
  localRiskLevel?: RiskLevel
  localExceScore?: number
  reasons?: string[]
  entry?: {
    sentiment?: string
    emotion?: string
    situation?: string
    details?: string
  }
  supportMemories?: Array<{
    dateKey?: string
    emotion?: string
    situation?: string
    details?: string
  }>
}

const MODEL = '@cf/meta/llama-3.1-8b-instruct'

export async function handleRiskAssessment(request: Request, env: Env): Promise<Response> {
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

  if (!body.entry || typeof body.entry !== 'object') {
    return corsJson({ error: 'entry is required' }, 400, env, origin)
  }

  try {
    const result = await assessWithAi(env, body)
    return corsJson(result, 200, env, origin)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Risk assessment failed'
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

function clamp01(n: number) {
  return Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0))
}

function levelFor(score: number): RiskLevel {
  if (score >= 0.75) return 'crisis'
  if (score >= 0.35) return 'elevated'
  if (score > 0) return 'low'
  return 'none'
}

function minimumScoreForLevel(level: RiskLevel) {
  if (level === 'crisis') return 0.75
  if (level === 'elevated') return 0.35
  if (level === 'low') return 0.1
  return 0
}

function parseRiskLevel(value: unknown): RiskLevel | null {
  if (value === 'none' || value === 'low' || value === 'elevated' || value === 'crisis') {
    return value
  }
  return null
}

async function assessWithAi(env: Env, body: RequestBody) {
  const rawLocalRiskScore = clamp01(Number(body.localRiskScore))
  const localRiskLevel = parseRiskLevel(body.localRiskLevel) ?? levelFor(rawLocalRiskScore)
  const localRiskScore = Math.max(rawLocalRiskScore, minimumScoreForLevel(localRiskLevel))
  const journalJson = JSON.stringify({
    localRiskScore,
    localRiskLevel,
    localExceScore: Number.isFinite(Number(body.localExceScore))
      ? Math.max(0, Math.trunc(Number(body.localExceScore)))
      : 0,
    localReasons: Array.isArray(body.reasons) ? body.reasons.slice(0, 6) : [],
    entry: {
      sentiment: body.entry?.sentiment ?? '',
      emotion: body.entry?.emotion ?? '',
      situation: body.entry?.situation ?? '',
      details: body.entry?.details ?? '',
    },
    supportMemories: Array.isArray(body.supportMemories)
      ? body.supportMemories.slice(0, 3).map((memory) => ({
          dateKey: memory.dateKey ?? '',
          emotion: memory.emotion ?? '',
          situation: memory.situation ?? '',
          details: memory.details ?? '',
        }))
      : [],
  })

  const result = await env.AI.run(MODEL, {
    messages: [
      {
        role: 'system',
        content: `You are a conservative safety classifier for a private journaling app.
Return JSON only. Do not include markdown.
Schema: {"riskScore":number,"riskLevel":"none"|"low"|"elevated"|"crisis","reasons":string[],"supportiveMessage":string}
You may also include "responseKind":"risk"|"support"|"celebration".
The score is 0.0 to 1.0. Never lower the provided local risk below its current level unless clearly false positive.
Use "crisis" for imminent self-harm, suicide intent, overdose, or immediate danger language.
Treat statements like "I don't want to live", "I can't take it anymore", or "I'm going to do it" as crisis unless the text clearly grounds the phrase in a non-self-harm meaning.
If a statement mentions not wanting to live without a specific non-self-harm grounding statement, bump it to at least "elevated" and usually "crisis".
Use "elevated" for strong distress where professional or trusted support should be encouraged.
If localExceScore is 5 or higher and there is no safety concern, return riskLevel "none", riskScore 0, responseKind "celebration", and write a short congratulatory supportiveMessage like a proud friend.
If the message is distressed but not self-harm or crisis, riskLevel may be "low"; write a grounded motivational supportiveMessage. When supportMemories are present, mention one concrete good or calm moment from them in a "remember when..." style without overpromising.
Do not diagnose or provide medical advice. The supportive message must be warm, short, and encourage trusted support or emergency/crisis support when appropriate.`,
      },
      { role: 'user', content: journalJson },
    ],
  })

  const raw = extractAiText(result)
  const parsed = parseJsonObject(raw)
  const parsedLevel = parseRiskLevel(parsed.riskLevel)
  const score = Math.max(
    localRiskScore,
    clamp01(Number(parsed.riskScore)),
    parsedLevel ? minimumScoreForLevel(parsedLevel) : 0,
  )
  const riskLevel = levelFor(score)
  const reasons = Array.isArray(parsed.reasons)
    ? parsed.reasons.filter((row): row is string => typeof row === 'string').slice(0, 4)
    : []
  const supportiveMessage =
    typeof parsed.supportiveMessage === 'string'
      ? parsed.supportiveMessage.slice(0, 240)
      : 'You are cared about. If this feels hard to carry, please reach out to someone you trust or a crisis support service.'

  const responseKind =
    parsed.responseKind === 'risk' ||
    parsed.responseKind === 'support' ||
    parsed.responseKind === 'celebration'
      ? parsed.responseKind
      : riskLevel === 'elevated' || riskLevel === 'crisis'
        ? 'risk'
        : Number(body.localExceScore) >= 5
          ? 'celebration'
          : 'support'

  return { riskScore: score, riskLevel, reasons, supportiveMessage, responseKind }
}

function parseJsonObject(raw: string) {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('Model did not return JSON')
  return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>
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

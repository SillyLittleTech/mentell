import { corsJson, corsResponse } from './cors'
import type { Env } from './env'

type RiskLevel = 'none' | 'low' | 'elevated' | 'crisis'

type RequestBody = {
  localRiskScore?: number
  localInterventionScore?: number
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
    id?: string
    dateKey?: string
    emotion?: string
    situation?: string
    details?: string
    relevance?: number
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

function clampInterventionScore(n: number) {
  return Math.min(3, Math.max(-3, Number.isFinite(n) ? n : 0))
}

type ResponseKind = 'none' | 'positive' | 'support' | 'crisis'

function parseResponseKind(value: unknown): ResponseKind | null {
  if (value === 'none' || value === 'positive' || value === 'support' || value === 'crisis') {
    return value
  }
  return null
}

function responseKindForIntervention(score: number): ResponseKind {
  if (score >= 2) return 'crisis'
  if (score > 0) return 'support'
  if (score <= -1) return 'positive'
  return 'none'
}

function riskScoreForIntervention(score: number) {
  return score > 0 ? clamp01(score / 2) : 0
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
  const localInterventionScore = clampInterventionScore(Number(body.localInterventionScore))
  const localRiskLevel = parseRiskLevel(body.localRiskLevel) ?? levelFor(rawLocalRiskScore)
  const localRiskScore = Math.max(rawLocalRiskScore, minimumScoreForLevel(localRiskLevel))
  const journalJson = JSON.stringify({
    localRiskScore,
    localInterventionScore,
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
          id: memory.id ?? '',
          dateKey: memory.dateKey ?? '',
          emotion: memory.emotion ?? '',
          situation: memory.situation ?? '',
          details: memory.details ?? '',
          relevance: Number.isFinite(Number(memory.relevance)) ? Number(memory.relevance) : 0,
        }))
      : [],
  })

  const result = await env.AI.run(MODEL, {
    messages: [
      {
        role: 'system',
        content: `You are a context-aware safety and encouragement classifier for a private journaling app.
Return JSON only. Do not include markdown.
Schema: {"interventionScore":number,"responseKind":"none"|"positive"|"support"|"crisis","riskScore":number,"riskLevel":"none"|"low"|"elevated"|"crisis","reasons":string[],"supportiveMessage":string}
Use interventionScore as the final decision score: <= -1 means positive encouragement, > 0 and < 2 means support, >= 2 means crisis, otherwise none.
Classify by intent and context, not keywords alone. You may lower localInterventionScore when local flags are clearly false positives.
Examples: "I killed this test", "I killed it", or "I'm killing it" should be positive or none, not crisis.
Examples: "I want to kill myself", "I can't stay safe", suicide intent, overdose intent, or immediate danger must be crisis with interventionScore >= 2.
Sad, anxious, lonely, or overwhelmed messages without self-harm should usually be support with interventionScore between 0.5 and 1.8.
Strong achievement, gratitude, joy, relief, or excitement should usually be positive with interventionScore <= -1.
If localExceScore is 5 or higher and there is no safety concern, prefer positive encouragement.
For support responses, supportMemories are ranked by relevance. If a memory fits, mention one concrete detail from the first relevant memory in a gentle "remember when..." style. Use at most one memory, and do not force a memory if it feels unrelated.
For crisis responses, supportiveMessage must keep safety first while helping de-escalate. Include direct guidance to reach trusted support, emergency services, or a crisis line if immediate safety may be at risk; include one short grounding or next-step suggestion; and include one context-appropriate "hang in there" or future-oriented reassurance.
Tune crisis tone to severity: imminent danger should be brief, direct, action-first, and use minimal optimism; severe distress without an immediate plan can be warmer and stabilizing with gentle hope; ambiguous high-intensity language should stay validating, calm, and non-alarming.
For responseKind "none", supportiveMessage may be an empty string. Otherwise write a warm short message. Do not diagnose or provide medical advice. Crisis messages should encourage trusted support and emergency/crisis support when immediate safety may be at risk.`,
      },
      { role: 'user', content: journalJson },
    ],
  })

  const raw = extractAiText(result)
  const parsed = parseJsonObject(raw)
  const parsedKind = parseResponseKind(parsed.responseKind)
  let interventionScore = clampInterventionScore(Number(parsed.interventionScore))
  if (parsedKind === 'crisis') interventionScore = Math.max(interventionScore, 2)
  if (parsedKind === 'support') interventionScore = Math.min(Math.max(interventionScore, 0.5), 1.9)
  if (parsedKind === 'positive') interventionScore = Math.min(interventionScore, -1)
  if (parsedKind === 'none') interventionScore = Math.abs(interventionScore) < 1 ? 0 : interventionScore
  const responseKind = parsedKind ?? responseKindForIntervention(interventionScore)
  const score = riskScoreForIntervention(interventionScore)
  const riskLevel = interventionScore >= 2 ? 'crisis' : levelFor(score)
  const reasons = Array.isArray(parsed.reasons)
    ? parsed.reasons.filter((row): row is string => typeof row === 'string').slice(0, 4)
    : []
  const supportiveMessage =
    typeof parsed.supportiveMessage === 'string'
      ? parsed.supportiveMessage.slice(0, 240)
      : responseKind === 'crisis'
        ? 'If you may not be safe, contact emergency services, 988, or someone you trust now. Take one slow breath and stay near another person if you can. This moment can pass.'
        : responseKind === 'support'
          ? 'This sounds like a heavy moment. You do not have to carry it by yourself.'
          : responseKind === 'positive'
            ? 'That sounds like something worth noticing. Keep going.'
            : ''

  return { interventionScore, riskScore: score, riskLevel, reasons, supportiveMessage, responseKind }
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

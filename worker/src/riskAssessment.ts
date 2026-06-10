import { corsJson, corsResponse } from './cors'
import type { Env } from './env'

type RiskLevel = 'none' | 'low' | 'elevated' | 'crisis'

type RequestBody = {
  localRiskScore?: number
  localInterventionScore?: number
  localRiskLevel?: RiskLevel
  localResponseKind?: ResponseKind
  localExceScore?: number
  localLiteralSentimentLabel?: string
  localLiteralSentimentConfidence?: number
  localLiteralSentimentScore?: number
  localSemanticRiskLabel?: string
  localSemanticRiskConfidence?: number
  localSemanticRiskSource?: string
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

const GUARD_MODEL = '@cf/meta/llama-guard-3-8b'
const RESPONSE_MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8'
const SENTIMENT_MODEL = '@cf/huggingface/distilbert-sst-2-int8'
const POSITIVE_ENCOURAGEMENT_THRESHOLD = -0.85
const POSITIVE_EXCE_THRESHOLD = 4
const NEGATIVE_SUPPORT_THRESHOLD = 0.85
const NEGATIVE_GUARD_THRESHOLD = 0.75
const WORKER_RISK_LANGUAGE_PATTERN =
  /\b(?:suicide|suicidal|kill\s+(?:myself|me|someone|somebody|them|him|her|people|others)|murder|hurt\s+(?:myself|me|someone|somebody|them|him|her|people|others)|harm\s+(?:myself|me|someone|somebody|them|him|her|people|others)|self-?harm|overdose|stab|shoot|weapon|(?:his|her|their|this)\s+breath\s+(?:will\s+be\s+)?(?:(?:his|her|their)\s+|the\s+)?(?:last|final)|can't\s+stay\s+safe|cant\s+stay\s+safe|not\s+safe\s+(?:alone|with\s+myself)|wish\s+i\s+(?:was|were)\s+dead|want\s+to\s+die|end\s+(?:my\s+life|myself|it\s+all)|ending\s+(?:the\s+)?(?:story|book|chapter)\s+(?:that\s+is\s+)?(?:my\s+)?life|(?:story|book|chapter)\s+(?:that\s+is\s+)?(?:my\s+)?life\s+(?:ends|is\s+ending)|final\s+goodbye|last\s+goodbye|do\s+something\s+(?:stupid|i\s+regret|i'll\s+regret)|rash\s+decision|crash\s+my\s+car)\b/i

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
type LiteralSentimentLabel = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'

type LiteralSentiment = {
  label: LiteralSentimentLabel
  confidence: number
  score: number
  source: 'worker' | 'fallback'
}

function riskScoreForIntervention(score: number) {
  return score >= 2 ? clamp01(score / 2) : 0
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
  const entryText = `${body.entry?.situation ?? ''}\n${body.entry?.details ?? ''}`.replace(/\s+/g, ' ').trim()
  const literalSentiment = await scoreSentimentWithAi(env, entryText, body)
  const journalJson = JSON.stringify({
    localRiskScore,
    localInterventionScore,
    localRiskLevel,
    localResponseKind: body.localResponseKind ?? '',
    localLiteralSentimentLabel: body.localLiteralSentimentLabel ?? '',
    localLiteralSentimentConfidence: Number(body.localLiteralSentimentConfidence),
    localLiteralSentimentScore: Number(body.localLiteralSentimentScore),
    localSemanticRiskLabel: body.localSemanticRiskLabel ?? '',
    localSemanticRiskConfidence: Number(body.localSemanticRiskConfidence),
    localSemanticRiskSource: body.localSemanticRiskSource ?? '',
    workerLiteralSentimentLabel: literalSentiment.label,
    workerLiteralSentimentConfidence: literalSentiment.confidence,
    workerLiteralSentimentScore: literalSentiment.score,
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

  const shouldGuard =
    localRiskLevel === 'crisis' ||
    localInterventionScore >= 2 ||
    WORKER_RISK_LANGUAGE_PATTERN.test(entryText) ||
    literalSentiment.score >= NEGATIVE_GUARD_THRESHOLD
  const guard = shouldGuard
    ? await assessGuard(env, journalJson, body)
    : { safe: true, categories: [] }
  const localCrisis = localRiskLevel === 'crisis' || localInterventionScore >= 2
  const assessment = await generateAssessmentWithAi(env, body, journalJson, literalSentiment, guard, localCrisis)
  const responseKind = assessment.responseKind
  const interventionScore = assessment.interventionScore
  const score = riskScoreForIntervention(interventionScore)
  const riskLevel = interventionScore >= 2 ? 'crisis' : levelFor(score)
  const reasons = [
    `sentiment: ${literalSentiment.label.toLowerCase()} ${literalSentiment.confidence.toFixed(2)}`,
    ...(shouldGuard
      ? guard.safe
        ? ['llama guard safe']
        : ['llama guard unsafe', ...guard.categories.map((category) => `guard: ${category}`)]
      : ['llama guard skipped']),
  ]
  if (guard.error) reasons.push('llama guard unavailable')
  const supportiveMessage = assessment.supportiveMessage

  return {
    guardSafe: guard.safe,
    guardCategories: guard.categories,
    literalSentimentLabel: literalSentiment.label,
    literalSentimentConfidence: literalSentiment.confidence,
    literalSentimentScore: literalSentiment.score,
    sentimentModelSource: literalSentiment.source,
    interventionScore,
    riskScore: score,
    riskLevel,
    reasons,
    supportiveMessage,
    responseKind,
  }
}

async function generateAssessmentWithAi(
  env: Env,
  body: RequestBody,
  journalJson: string,
  literalSentiment: LiteralSentiment,
  guard: GuardResult,
  localCrisis: boolean,
) {
  const hardLocalCrisis = localCrisis && Array.isArray(body.reasons) && body.reasons.some((reason) =>
    reason === 'self-harm language' ||
    reason === 'other-harm language' ||
    reason === 'overdose language' ||
    reason === 'rash action language',
  )
  const fallbackKind = hardLocalCrisis || localCrisis || !guard.safe
    ? 'crisis'
    : body.localResponseKind === 'support'
      ? 'support'
      : body.localResponseKind === 'positive'
        ? 'positive'
        : Number(body.localExceScore) >= POSITIVE_EXCE_THRESHOLD &&
        literalSentiment.score <= POSITIVE_ENCOURAGEMENT_THRESHOLD
          ? 'positive'
          : literalSentiment.score >= NEGATIVE_SUPPORT_THRESHOLD
            ? 'support'
            : 'none'
  const fallback =
    fallbackKind === 'crisis'
      ? buildAssessment('crisis', literalSentiment.score, supportMessageFor('crisis', body))
      : buildAssessment('none', literalSentiment.score, '')

  try {
    const result = await env.AI.run(RESPONSE_MODEL, {
      messages: [
        {
          role: 'system',
          content: `You are a context-aware safety, support, and encouragement classifier for a private journaling app.
Return JSON only. Do not include markdown.
Schema: {"responseKind":"none"|"positive"|"support"|"crisis","supportiveMessage":"string"}
The safety lane always wins over sentiment. Use crisis for self-harm, suicide, overdose, violence toward others, major rash financial actions, immediate danger, or other harmful actions the writer seems close to taking and may regret. Self-harm includes wanting/planning to cut, burn, scratch, pick skin, pull hair, bleed, feel pain, saying pain or hurting feels good, use a blade/razor/lighter, or hurt themselves in any way. This includes veiled, metaphorical, coded, euphemistic, or indirect intent when the likely meaning is harm or imminent danger. Use support only when the writer is clearly collapsing into self-worth distress, feeling useless/worthless/weak/unlovable, hating themselves, feeling like a burden/failure, struggling with body image or feeling fat/ugly/unattractive, or describing a truly terrible day without actionable danger. Ordinary sadness, sickness, tiredness, frustration, stress, disappointment, or mixed feelings should usually be none. Use positive only for strongly positive entries without danger.
Classify by intent and context, not keywords alone. "I killed this test", "I killed it", and "I'm killing it" are positive or none. "I'm going to kill someone", "I want to hurt myself", "I want to cut", "I might use a razor", "I can't stay safe", threats toward others, overdose intent, or immediate danger are crisis. Phrases like "snuff him out", "take him out tonight", "this breath will be his last", "ending the story that is my life", "I can't take this anymore" with unsafe context, or "they won't see tomorrow" are crisis unless the entry clearly makes them fictional, quoted, or idiomatic.
For crisis, generate a de-escalation note. Refer to the specific harmful action or urge, slow the moment down, and suggest healthy alternatives matched to the situation. For violence, suggest leaving the scene, cold water, movement, breathing, writing the unsent message, or contacting a safe person. For self-harm, suggest getting near someone safe, moving means away, grounding, and one personally enjoyable or comforting action from the entry if available. For rash financial actions, suggest a 24-hour pause, moving the app/card out of reach, writing the decision down without acting, and asking a trusted person to sit with the decision. Encourage trusted support/emergency/crisis help if anyone may be in danger. Keep crisis responses stabilizing and action-oriented, not reflective or memory-heavy.
For support, generate a reflection-and-reassurance note. Directly meet the self-worth, body-image, unsupported, or bad-day content without treating it as crisis. Do not merely quote the entry. If the writer calls themselves worthless/useless/weak, gently separate that feeling from their identity. If the writer attacks their body or appearance, respond with body-image support and suggest taking space from comparison, mirrors, or harsh comments. If the writer mentions no support, feeling alone, ignored, abandoned, or unsupported, explicitly offer a sense of being accompanied in the note and name one small way to seek steadiness without asking for a reply. When supportMemories include any relevant positive/calm memory, explicitly recall one concrete detail from the best memory as evidence that this hard moment is not the whole picture; skip memory only if none fits at all. The note should feel like a steady shoulder with memory and reflection, not a warning.
For positive, only respond to genuine achievements, relief, gratitude, pride, or joy; mention the concrete achievement/content rather than generic praise.
This is not a chat interface. Never ask the user a follow-up question, never invite a reply, and never write "tell me", "can you", "would you", "do you want", or similar response-seeking language. Write as a finished supportive note.
For none, supportiveMessage must be empty.`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            localSuggestedResponseKind: fallbackKind,
            localCrisis,
            guardSafe: guard.safe,
            guardCategories: guard.categories,
            literalSentiment,
            journal: JSON.parse(journalJson) as unknown,
            schema: {
              responseKind: 'none|positive|support|crisis',
              supportiveMessage: 'string',
            },
          }),
        },
      ],
      max_tokens: 220,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    })
    const parsed = parseJsonObject(extractAiText(result))
    const parsedKind = parseResponseKind(parsed.responseKind)
    const canEncourage =
      Number(body.localExceScore) >= POSITIVE_EXCE_THRESHOLD &&
      literalSentiment.score <= POSITIVE_ENCOURAGEMENT_THRESHOLD
    const responseKind =
      !guard.safe || hardLocalCrisis
        ? 'crisis'
        : fallbackKind !== 'none' && fallbackKind !== 'crisis' && (parsedKind === 'none' || parsedKind === null)
          ? fallbackKind
        : parsedKind === 'positive' && !canEncourage
          ? 'none'
          : (parsedKind ?? fallbackKind)
    const generatedMessage =
      typeof parsed.supportiveMessage === 'string' ? parsed.supportiveMessage.trim().slice(0, 520) : ''
    if (responseKind !== 'none' && !generatedMessage) {
      return responseKind === 'crisis'
        ? buildAssessment('crisis', literalSentiment.score, supportMessageFor('crisis', body))
        : buildAssessment('none', literalSentiment.score, '')
    }
    return buildAssessment(responseKind, literalSentiment.score, generatedMessage)
  } catch {
    return fallback
  }
}

function buildAssessment(kind: ResponseKind, literalScore: number, supportiveMessage: string) {
  const interventionScore =
    kind === 'crisis'
      ? 2.2
      : kind === 'positive'
        ? Math.min(-1, literalScore)
        : literalScore
  return { responseKind: kind, interventionScore, supportiveMessage }
}

function parseResponseKind(value: unknown): ResponseKind | null {
  if (value === 'none' || value === 'positive' || value === 'support' || value === 'crisis') {
    return value
  }
  return null
}

async function scoreSentimentWithAi(
  env: Env,
  text: string,
  body: RequestBody,
): Promise<LiteralSentiment> {
  if (!text || text.length < 3) {
    return { label: 'NEUTRAL', confidence: 0, score: 0, source: 'worker' }
  }

  try {
    const result = await env.AI.run(SENTIMENT_MODEL, { text })
    const row = Array.isArray(result)
      ? result
          .filter((candidate) => candidate && typeof candidate === 'object')
          .map((candidate) => candidate as { label?: unknown; score?: unknown })
          .sort((a, b) => Number(b.score) - Number(a.score))[0]
      : null
    const label = row?.label === 'POSITIVE' || row?.label === 'NEGATIVE' ? row.label : 'NEUTRAL'
    const confidence = clamp01(Number(row?.score))
    const score = label === 'NEGATIVE' ? confidence : label === 'POSITIVE' ? -confidence : 0
    return { label, confidence, score, source: 'worker' }
  } catch {
    const label =
      body.localLiteralSentimentLabel === 'POSITIVE' || body.localLiteralSentimentLabel === 'NEGATIVE'
        ? body.localLiteralSentimentLabel
        : 'NEUTRAL'
    const confidence = clamp01(Number(body.localLiteralSentimentConfidence))
    const score = clampInterventionScore(Number(body.localLiteralSentimentScore))
    return { label, confidence, score, source: 'fallback' }
  }
}

async function assessGuard(env: Env, journalJson: string, body: RequestBody): Promise<GuardResult> {
  try {
    const result = await env.AI.run(GUARD_MODEL, {
      messages: [
        {
          role: 'user',
          content:
            'Classify this private journal entry for self-harm, suicide, overdose, violence toward others, immediate physical danger, or rash irreversible actions the writer may soon regret. Treat veiled, metaphorical, coded, euphemistic, or indirect harm intent as unsafe when the likely meaning is self-harm, violence, or imminent danger. Examples of unsafe phrasing include "snuff him out", "take him out tonight", "this breath will be his last", "ending the story that is my life", and unsafe-context "I can’t take this anymore". Ordinary sadness, anxiety, grief, the word death, venting without intent, fictional/quoted text, and idioms like "I killed it" are safe.\n\n' +
            journalJson,
        },
      ],
      max_tokens: 64,
      temperature: 0,
      response_format: { type: 'json_object' },
    })
    return parseGuardResult(result)
  } catch (error) {
    return fallbackGuardResult(body, error)
  }
}

type GuardResult = {
  safe: boolean
  categories: string[]
  error?: string
}

function extractAiText(result: unknown) {
  if (typeof result === 'string') return result
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>
    if (r.response && typeof r.response === 'object') return JSON.stringify(r.response)
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

function parseGuardResult(result: unknown): GuardResult {
  if (result && typeof result === 'object') {
    const response = (result as Record<string, unknown>).response
    if (response && typeof response === 'object') {
      const row = response as Record<string, unknown>
      return {
        safe: row.safe !== false,
        categories: Array.isArray(row.categories)
          ? row.categories.filter((category): category is string => typeof category === 'string')
          : [],
      }
    }
  }
  return parseGuardResponse(extractAiText(result))
}

function parseGuardResponse(raw: string): GuardResult {
  try {
    const parsed = JSON.parse(raw) as { safe?: unknown; categories?: unknown }
    if (typeof parsed.safe === 'boolean') {
      return {
        safe: parsed.safe,
        categories: Array.isArray(parsed.categories)
          ? parsed.categories.filter((category): category is string => typeof category === 'string')
          : [],
      }
    }
  } catch {
    // Plain-text guard responses are handled below.
  }
  const normalized = raw.trim().toLowerCase()
  const firstLine = normalized.split(/\r?\n/, 1)[0]?.trim() ?? ''
  const safe = firstLine === 'safe' || (!firstLine.startsWith('unsafe') && !normalized.includes('unsafe'))
  const categories = safe
    ? []
    : raw
        .split(/\s+/)
        .map((token) => token.replace(/[^A-Za-z0-9_/-]/g, ''))
        .filter((token) => /^S\d+$/i.test(token) || /self|harm|suicide|violent|unsafe/i.test(token))
        .slice(0, 6)
  return { safe, categories }
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

function fallbackGuardResult(body: RequestBody, error: unknown): GuardResult {
  const localInterventionScore = Number(body.localInterventionScore)
  const localRiskLevel = parseRiskLevel(body.localRiskLevel)
  return {
    safe: !(localRiskLevel === 'crisis' || localInterventionScore >= 2),
    categories: [],
    error: error instanceof Error ? error.message : String(error),
  }
}

function supportMessageFor(kind: ResponseKind, body: RequestBody) {
  if (kind === 'crisis') {
    const text = `${body.entry?.situation ?? ''} ${body.entry?.details ?? ''}`.replace(/\s+/g, ' ').trim()
    const anchor = text ? `This sounds urgent around "${text.slice(0, 120)}." ` : ''
    if (
      /\b(?:kill|murder|hurt|harm|attack|stab|shoot|beat)\s+(?:someone|somebody|them|him|her|people|others|person)\b/i.test(text) ||
      /\b(?:snuff|wipe|erase)\s+(?:him|her|them|someone|somebody|[a-z][a-z'-]{1,24})\s+out\b/i.test(text) ||
      /\b(?:this|their|his|her)\s+breath\s+(?:will\s+be\s+)?(?:(?:his|her|their)\s+|the\s+)?(?:last|final)\b/i.test(text)
    ) {
      return `${anchor}Put distance between you and the person or place before doing anything else. Step away, get cold water on your hands or face, move your body hard for a minute, write the message you will not send, and contact a safe person now. If anyone may be in immediate danger, call emergency services.`
    }
    if (
      /\b(?:suicide|suicidal|kill\s+(?:myself|me)|hurt\s+(?:myself|me)|harm\s+(?:myself|me)|cut\s+(?:myself|me)?|burn\s+(?:myself|me)?|scratch\s+(?:myself|me)?|razor|blade|overdose|want\s+to\s+die|wish\s+i\s+(?:was|were)\s+dead|end\s+(?:my\s+life|myself|it\s+all)|not\s+safe)\b/i.test(text) ||
      /\b(?:end|ending|close|closing|finish|finishing)\s+(?:the\s+)?(?:story|book|chapter)\s+(?:that\s+is\s+)?(?:my\s+)?life\b/i.test(text)
    ) {
      return `${anchor}Move closer to another person and farther from anything you could use to hurt yourself. If cutting or another injury urge is close, put the tool in another room, hold ice or a cold cloth, name five objects nearby, and contact 988 or a trusted person before acting.`
    }
    return `${anchor}Slow the next few minutes down before taking action. Delay the decision, leave the trigger if you can, write down what you want to do without doing it, and ask one steady person to stay with you. If anyone could be in danger, contact emergency services or 988.`
  }
  return ''
}

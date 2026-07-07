import { corsJson, corsResponse } from './cors'
import type { Env } from './env'

type RiskLevel = 'none' | 'low' | 'elevated' | 'crisis'

type RequestBody = {
  localRiskScore?: number
  localInterventionScore?: number
  localRiskLevel?: RiskLevel
  localResponseKind?: ResponseKind
  localCrisisHardLock?: boolean
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
const RESPONSE_MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct'
const SENTIMENT_MODEL = '@cf/huggingface/distilbert-sst-2-int8'
const POSITIVE_ENCOURAGEMENT_THRESHOLD = -0.85
const POSITIVE_EXCE_THRESHOLD = 4
const NEGATIVE_SUPPORT_THRESHOLD = 0.85
const NEGATIVE_GUARD_THRESHOLD = 0.75
const WORKER_RISK_LANGUAGE_PATTERN =
  /\b(?:suicide|suicidal|kill\s+(?:myself|me|someone|somebody|them|him|her|people|others)|murder|hurt\s+(?:myself|me|someone|somebody|them|him|her|people|others)|harm\s+(?:myself|me|someone|somebody|them|him|her|people|others)|self-?harm|overdose|stab|shoot|weapon|razor|blade|lighter|cigarette|punish\s+myself|make\s+myself\s+pay|deserve\s+(?:pain|to\s+hurt|to\s+bleed)|want\s+to\s+see\s+blood|need\s+to\s+see\s+blood|open\s+my\s+skin|carve\s+into\s+my\s+skin|(?:his|her|their|this)\s+breath\s+(?:will\s+be\s+)?(?:(?:his|her|their)\s+|the\s+)?(?:last|final)|can't\s+stay\s+safe|cant\s+stay\s+safe|not\s+safe\s+(?:alone|with\s+myself)|wish\s+i\s+(?:was|were)\s+dead|want\s+to\s+die|end\s+(?:my\s+life|myself|it\s+all)|ending\s+(?:the\s+)?(?:story|book|chapter)\s+(?:that\s+is\s+)?(?:my\s+)?life|(?:story|book|chapter)\s+(?:that\s+is\s+)?(?:my\s+)?life\s+(?:ends|is\s+ending)|final\s+goodbye|last\s+goodbye|do\s+something\s+(?:stupid|i\s+regret|i'll\s+regret)|rash\s+decision|crash\s+my\s+car)\b/i

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

function normalizeToken(raw?: string) {
  if (!raw) return ''
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
    localCrisisHardLock: body.localCrisisHardLock === true,
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
  const hardLocalCrisis = localCrisis && body.localCrisisHardLock === true
  const fallbackKind = hardLocalCrisis || localCrisis || !guard.safe
    ? 'crisis'
    : body.localResponseKind === 'support'
      ? 'support'
      : body.localResponseKind === 'positive'
        ? 'positive'
        : Number(body.localExceScore) >= POSITIVE_EXCE_THRESHOLD &&
        literalSentiment.score <= POSITIVE_ENCOURAGEMENT_THRESHOLD
          ? 'positive'
          : 'none'
  const fallback =
    fallbackKind === 'none'
      ? buildAssessment('none', literalSentiment.score, '')
      : buildAssessment(fallbackKind, literalSentiment.score, supportMessageFor(fallbackKind, body))

  try {
    const result = await env.AI.run(RESPONSE_MODEL, {
      messages: [
        {
          role: 'system',
          content: `You are a context-aware safety, support, and encouragement classifier for a private journaling app.
Return JSON only. Do not include markdown.
Schema: {"responseKind":"none"|"positive"|"support"|"crisis","supportiveMessage":"string"}
You are the adjudicator, not a rubber stamp. You may upgrade or downgrade localSuggestedResponseKind. Use crisis for self-harm, suicide, overdose, violence toward others, immediate danger, or major rash actions the writer seems close to taking. Upgrade support or positive to crisis when actionable danger appears. Downgrade crisis to support or none when the wording is accidental, medical, fictional, quoted, or idiomatic, such as "I cut myself chopping veggies" with no unsafe intent. Downgrade positive/support to none when the entry is ordinary, mildly good, mildly bad, or only uses a flagged word casually. Switch positive to support when the entry is actually a hard negative self-worth moment. Switch support to positive when it is actually a rare good milestone.
Use support only for major negative moments without actionable danger: social humiliation, being made fun of, sharp self-worth collapse, body-image spirals, feeling abandoned/unsupported, or a genuinely terrible day. Use positive only for major positive moments: making friends, trying something new, opening up, breakthroughs, acceptance, big achievements, relief after something hard, or life-changing joy. Ordinary sadness, sickness, tiredness, frustration, stress, disappointment, normal happy days, or mixed feelings should be none.
Classify by intent and context, not keywords alone. "I killed this test", "I killed it", and "I'm killing it" are positive or none. "I'm going to kill someone", "I want to hurt myself", "I want to cut", "I might use a razor", "I deserve to bleed", "I can't stay safe", threats toward others, overdose intent, or immediate danger are crisis. Phrases like "snuff him out", "take him out tonight", "this breath will be his last", "ending the story that is my life", "I can't take this anymore" with unsafe context, or "they won't see tomorrow" are crisis unless the entry clearly makes them fictional, quoted, or idiomatic.
For crisis, generate a calm de-escalation note. Name the specific harmful action or urge in plain words, such as cutting, burning, using a razor, overdosing, hurting someone, or making a rash financial decision. Avoid canned grounding scripts and do not reuse a fixed phrase like "name five objects." Choose 2-3 alternatives that fit the entry: move the means away, change rooms, get near another person, put a barrier between the writer and the action, cool the body with water or ice, write without sending, pause money/apps/cards, or contact a trusted person/988/emergency help when danger is close. Keep it direct, natural, and not generic.
Do not use generic filler like "take a deep breath", "focus on your surroundings", or "try grounding" unless you tie it to the specific situation in fresh language.
For support, generate a natural reflection-and-reassurance note. Directly meet the self-worth, body-image, unsupported, mocked, humiliated, or bad-day content without treating it as crisis. If the writer doubts skill or capability, keep worth separate from today's performance. When supportMemories include any relevant positive/calm memory, recall one concrete detail in a natural sentence; do not force awkward quoted fragments. The note should feel like a steady shoulder with memory and reflection, not a warning.
For positive, generate a natural encouragement note only for major achievements, relief, gratitude, pride, joy, making friends, trying something new, or life-changing positive moments. Mention the concrete event in normal grammar and make it feel personal, not like a template label.
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
      max_tokens: 320,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    })
    const parsed = parseJsonObject(extractAiText(result))
    const parsedKind = parseResponseKind(parsed.responseKind)
    const canEncourage =
      body.localResponseKind === 'positive' ||
      Number(body.localExceScore) >= POSITIVE_EXCE_THRESHOLD &&
      literalSentiment.score <= POSITIVE_ENCOURAGEMENT_THRESHOLD
    const responseKind =
      !guard.safe || hardLocalCrisis
        ? 'crisis'
        : fallbackKind !== 'none' && fallbackKind !== 'crisis' && parsedKind === null
          ? fallbackKind
        : parsedKind === 'positive' && !canEncourage
          ? 'none'
          : (parsedKind ?? fallbackKind)
    const generatedMessage =
      typeof parsed.supportiveMessage === 'string' ? parsed.supportiveMessage.trim().slice(0, 700) : ''
    if (
      responseKind !== 'none' &&
      (!generatedMessage || asksForReply(generatedMessage) || (responseKind === 'crisis' && hasCannedCrisisLanguage(generatedMessage)))
    ) {
      const fallbackMessage = supportMessageFor(responseKind, body)
      return fallbackMessage
        ? buildAssessment(responseKind, literalSentiment.score, fallbackMessage)
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
        : kind === 'support'
          ? Math.max(NEGATIVE_SUPPORT_THRESHOLD, literalScore)
        : literalScore
  return { responseKind: kind, interventionScore, supportiveMessage }
}

function parseResponseKind(value: unknown): ResponseKind | null {
  if (value === 'none' || value === 'positive' || value === 'support' || value === 'crisis') {
    return value
  }
  return null
}

function asksForReply(message: string) {
  return (
    message.includes('?') ||
    /\b(?:tell\s+me|can\s+you|could\s+you|would\s+you|do\s+you\s+want|will\s+you|want\s+to\s+share|if\s+you\s+want\s+to\s+talk)\b/i.test(message)
  )
}

function hasCannedCrisisLanguage(message: string) {
  return /\b(?:name\s+five\s+objects|take\s+(?:a\s+few\s+)?deep\s+breaths?|focus\s+on\s+your\s+surroundings|try\s+grounding|grounding\s+techniques?)\b/i.test(message)
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

function compactText(value: string | undefined, max = 120) {
  const text = (value ?? '').replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  return text.slice(0, max - 1).trimEnd() + '...'
}

function entryText(body: RequestBody) {
  return `${body.entry?.situation ?? ''} ${body.entry?.details ?? ''}`.replace(/\s+/g, ' ').trim()
}

function bestSupportMemory(body: RequestBody) {
  return Array.isArray(body.supportMemories)
    ? [...body.supportMemories]
        .filter((memory) => memory && (memory.situation || memory.details || memory.emotion))
        .sort((a, b) => Number(b.relevance) - Number(a.relevance))[0]
    : undefined
}

function memorySentence(body: RequestBody) {
  const memory = bestSupportMemory(body)
  if (!memory) return ''
  const situation = compactText(memory.situation, 110)
  const details = compactText(memory.details, 150)
  if (situation && details) {
    return ` Keep this nearby too: ${situation}. ${details} That memory does not erase today, but it does push back against the harsh verdict.`
  }
  const detail = situation || details || compactText(memory.emotion, 100)
  return detail ? ` Keep this nearby too: ${detail}. It does not erase today, but it does push back against the harsh verdict.` : ''
}

function selfHarmActionPhrase(text: string) {
  if (/\b(?:razor|blade|knife)\b/i.test(text)) return 'using a sharp object to hurt yourself'
  if (/\b(?:lighter|cigarette)\b/i.test(text)) return 'burning yourself'
  if (/\boverdose|too\s+many\s+pills\b/i.test(text)) return 'taking too much medication'
  if (/\b(?:cut|cutting|carve|slice)\b/i.test(text)) return 'cutting yourself'
  if (/\b(?:burn|burning)\b/i.test(text)) return 'burning yourself'
  if (/\b(?:scratch|scratching|pick|picking)\b/i.test(text)) return 'scratching or picking your skin'
  if (/\b(?:pull|pulling)\s+(?:my\s+)?hair\b/i.test(text)) return 'pulling your hair'
  if (/\b(?:blood|bleed|bleeding)\b/i.test(text)) return 'making yourself bleed'
  if (/\b(?:pain|hurt|punish)\b/i.test(text)) return 'hurting or punishing yourself'
  return 'hurting yourself'
}

function supportMessageFor(kind: ResponseKind, body: RequestBody) {
  const text = entryText(body)
  if (kind === 'crisis') {
    if (
      /\b(?:kill|murder|hurt|harm|attack|stab|shoot|beat)\s+(?:someone|somebody|them|him|her|people|others|person)\b/i.test(text) ||
      /\b(?:snuff|wipe|erase)\s+(?:him|her|them|someone|somebody|[a-z][a-z'-]{1,24})\s+out\b/i.test(text) ||
      /\b(?:this|their|his|her)\s+breath\s+(?:will\s+be\s+)?(?:(?:his|her|their)\s+|the\s+)?(?:last|final)\b/i.test(text)
    ) {
      return `Because this points toward hurting someone else, distance matters first. Step away from the person or place, put your hands under cold water, write the message without sending it, and contact a safe person now. If anyone may be in immediate danger, call emergency services.`
    }
    if (
      /\b(?:suicide|suicidal|kill\s+(?:myself|me)|hurt\s+(?:myself|me)|harm\s+(?:myself|me)|cut\s+(?:myself|me)?|burn\s+(?:myself|me)?|scratch\s+(?:myself|me)?|razor|blade|overdose|want\s+to\s+die|wish\s+i\s+(?:was|were)\s+dead|end\s+(?:my\s+life|myself|it\s+all)|not\s+safe)\b/i.test(text) ||
      /\b(?:end|ending|close|closing|finish|finishing)\s+(?:the\s+)?(?:story|book|chapter)\s+(?:that\s+is\s+)?(?:my\s+)?life\b/i.test(text)
    ) {
      const action = selfHarmActionPhrase(text)
      return `Because this points toward ${action}, create distance before the urge gets any louder. Put the tool or trigger in another room, move into a shared or brighter space, and contact 988 or a trusted person before acting.`
    }
    return `Slow the next few minutes down before taking action. Leave the trigger if you can, write down the choice without doing it, and ask one steady person to stay close while the intensity drops. If anyone could be in danger, contact emergency services or 988.`
  }
  if (kind === 'support') {
    const memory = memorySentence(body)
    if (/\b(?:made\s+fun\s+of|mocked|laughed\s+at|teased|ridiculed|humiliated|embarrassed|called\s+me)\b/i.test(text)) {
      return `Being mocked can make one cruel moment feel much bigger than it deserves to be. That treatment is not a measure of your intelligence or worth; let the sting settle before accepting any verdict about yourself.${memory}`
    }
    if (/\b(?:suck|bad\s+at|terrible\s+at|failed|not\s+smart\s+enough|not\s+talented\s+enough|not\s+cut\s+out|incapable|incompetent)\b/i.test(text)) {
      return `A hard attempt is not proof that you are incapable. It means this part is hard right now; let the harsh verdict cool down and keep your worth separate from today's performance.${memory}`
    }
    if (/\b(?:body|face|looks|appearance|ugly|fat|gross|disgusting|unattractive|hideous|repulsive)\b/i.test(text)) {
      return `The harsh body-image voice is loud here, but it does not get to define your body or your day. Create a little distance from mirrors, comparisons, or cruel comments, then choose one caring action that helps your body feel less like an enemy.${memory}`
    }
    if (/\b(?:alone|unsupported|ignored|abandoned|no\s+one\s+cares|nobody\s+cares|no\s+support)\b/i.test(text)) {
      return `This sounds lonely and heavy, and it deserves steadiness rather than silence. Let this note stand beside you for a minute, then do one small anchoring thing: sit somewhere softer, drink water, or send a simple check-in to a safe person.${memory}`
    }
    return `This sounds like a genuinely hard day, not a verdict on who you are. Let the feeling be real without letting it become your identity, then choose one small stabilizing action before the next thing.${memory}`
  }
  if (kind === 'positive') {
    const focus = compactText(body.entry?.situation || body.entry?.details || 'this bright moment', 130)
    if (/\b(?:new\s+friend|made\s+(?:a\s+)?(?:new\s+)?friends?|joined|first\s+time|tried\s+something\s+new|opened\s+up)\b/i.test(text)) {
      return `${focus} is the kind of bright step worth letting sink in. Trying something new and finding connection is not small; let it count as evidence that your world can widen.`
    }
    return `${focus} is worth marking. Let the pride, relief, or joy have a little room so it becomes evidence you can return to later.`
  }
  return ''
}

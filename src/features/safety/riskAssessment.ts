import { format, parseISO, subDays } from 'date-fns'
import { getDb, type EntryEmotion, type EntryRow, type EntrySentiment, type RiskLevel } from '../../db/schema'
import { isAiEnabledLocally } from '../../shared/settings/appSettings'
import { normalizeEndpointUrl } from '../compilation/weeklyAiSummary'

const CRISIS_TERMS = [
  'suicide',
  'suicidal',
  'kill',
  'die',
  'end my life',
  'end it all',
  'want to die',
  'want to disappear',
  'wish i was dead',
  'kill myself',
  'cant go on',
  "can't go on",
  'cannot go on',
  'dont want to be here',
  "don't want to be here",
  'not be here anymore',
  'better off without me',
  'everyone would be better off',
  'i will not be here',
  "i won't be here",
  'cant stay safe',
  "can't stay safe",
  'not safe with myself',
  'no reason to live',
]

const SELF_HARM_TERMS = [
  'harm',
  'hurt myself',
  'hurt me',
  'self harm',
  'self-harm',
  'cut myself',
  'harm myself',
  'make it stop',
]

const MEDICATION_TERMS = ['overdose', 'took too many', 'pills', 'meds', 'medication']

const INTENSITY_TERMS = [
  'can’t do this',
  "can't do this",
  'cannot do this',
  'cant do this',
  'can’t take it',
  "can't take it",
  'cannot take it',
  'cant take it',
  'take it anymore',
  'going to do it',
  'hopeless',
  'worthless',
  'unbearable',
  'nothing matters',
  'panic',
]

const AI_REVIEW_TERMS = [
  ...CRISIS_TERMS,
  ...SELF_HARM_TERMS,
  ...INTENSITY_TERMS,
  'i am done',
  "i'm done",
  'done with everything',
  'too much',
  'last straw',
  'no way out',
  'give up',
  'giving up',
]

const EXCE_TERMS = [
  'happy',
  'joy',
  'joyful',
  'grateful',
  'proud',
  'excited',
  'amazing',
  'wonderful',
  'fantastic',
  'great',
  'good day',
  'better',
  'relieved',
  'hopeful',
  'loved',
  'safe',
  'calm',
  'peaceful',
  'accomplished',
  'win',
  'celebrate',
]

const AI_RISK_REVIEW_THRESHOLD = 0.2
export const EXCE_AI_THRESHOLD = 5

export type RiskAssessmentInput = {
  sentiment: EntrySentiment
  emotion: EntryEmotion
  emotionNote: string
  situation: string
  details: string
}

export type RiskAssessment = {
  riskScore: number
  exceScore: number
  riskLevel: RiskLevel
  warningLevel: 'none' | 'warn'
  flaggedTerms: string[]
  reasons: string[]
  supportiveMessage?: string
  responseKind?: 'risk' | 'support' | 'celebration'
  source: 'local' | 'hybrid'
}

type RiskAssessmentOptions = {
  forceAi?: boolean
}

type WorkerRiskResponse = {
  riskScore?: unknown
  riskLevel?: unknown
  responseKind?: unknown
  reasons?: unknown
  supportiveMessage?: unknown
}

type SupportMemory = {
  dateKey: string
  emotion: string
  situation: string
  details: string
}

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

function unique(values: string[]) {
  return Array.from(new Set(values))
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0))
}

export function riskLevelForScore(score: number): RiskLevel {
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

function scoreTerms(normalized: string, terms: string[], weight: number) {
  const hits = terms.filter((term) => normalized.includes(normalize(term)))
  return { hits, score: hits.length ? Math.min(weight, hits.length * weight * 0.65) : 0 }
}

function scoreExce(input: RiskAssessmentInput) {
  const text = normalize(`${input.situation}\n${input.details}\n${input.emotionNote}`)
  let score = 0
  const hits = EXCE_TERMS.filter((term) => text.includes(normalize(term)))
  score += hits.length
  if (input.sentiment === '+') score += 2
  if (input.emotion === 'happy') score += 2
  if (input.emotion === 'calm') score += 1
  return { score, hits: unique(hits) }
}

function messageRisk(input: RiskAssessmentInput) {
  const text = normalize(`${input.situation}\n${input.details}\n${input.emotionNote}`)
  if (!text) return { score: 0, flaggedTerms: [] as string[], reasons: [] as string[] }

  const crisis = scoreTerms(text, CRISIS_TERMS, 0.78)
  const selfHarm = scoreTerms(text, SELF_HARM_TERMS, 0.7)
  const meds = scoreTerms(text, MEDICATION_TERMS, 0.3)
  const intensity = scoreTerms(text, INTENSITY_TERMS, 0.22)
  const reasons: string[] = []

  let score = crisis.score + selfHarm.score + meds.score + intensity.score
  if (input.sentiment === '-') score += 0.12
  if (input.sentiment === '=') score += 0.04
  if (input.emotion === 'sad' || input.emotion === 'angry') score += 0.08
  if (input.emotion === 'anxious') score += 0.07

  if (crisis.hits.length) reasons.push('crisis language')
  if (selfHarm.hits.length) reasons.push('self-harm language')
  if (meds.hits.length) reasons.push('medication or overdose language')
  if (intensity.hits.length) reasons.push('high-intensity distress language')
  if (input.sentiment === '-' || input.emotion === 'sad' || input.emotion === 'anxious') {
    reasons.push('difficult mood signal')
  }

  return {
    score: clamp01(score),
    flaggedTerms: unique([...crisis.hits, ...selfHarm.hits, ...meds.hits, ...intensity.hits]),
    reasons: unique(reasons),
  }
}

async function recentEntries(dateKey: string) {
  const end = parseISO(dateKey)
  const startKey = format(subDays(end, 7), 'yyyy-MM-dd')
  return getDb().entries.where('dateKey').between(startKey, dateKey, true, true).toArray()
}

async function recentSupportMemories(dateKey: string | undefined): Promise<SupportMemory[]> {
  if (!dateKey) return []
  const end = parseISO(dateKey)
  const startKey = format(subDays(end, 30), 'yyyy-MM-dd')
  const rows = await getDb().entries.where('dateKey').between(startKey, dateKey, true, true).toArray()
  return rows
    .filter((entry) => entry.sentiment === '+' || entry.emotion === 'happy' || entry.emotion === 'calm')
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 3)
    .map((entry) => ({
      dateKey: entry.dateKey,
      emotion: entry.emotionNote || entry.emotion,
      situation: entry.situation.slice(0, 140),
      details: entry.details.slice(0, 220),
    }))
}

function trendRisk(entries: EntryRow[]) {
  if (entries.length === 0) return { score: 0, reasons: [] as string[] }

  const negatives = entries.filter((entry) => entry.sentiment === '-').length
  const warnings = entries.filter((entry) => entry.warningLevel === 'warn').length
  const elevated = entries.filter((entry) => (entry.riskScore ?? 0) >= 0.35).length
  const crisis = entries.filter((entry) => entry.riskLevel === 'crisis').length

  let score = 0
  const reasons: string[] = []
  if (negatives >= 3) {
    score += 0.16
    reasons.push('several difficult entries this week')
  }
  if (warnings >= 2) {
    score += 0.18
    reasons.push('repeated concerning language recently')
  }
  if (elevated >= 2) {
    score += 0.14
    reasons.push('elevated recent risk trend')
  }
  if (crisis > 0) {
    score += 0.2
    reasons.push('recent crisis-level entry')
  }

  return { score: clamp01(score), reasons: unique(reasons) }
}

export async function assessLocalRisk(
  input: RiskAssessmentInput & { dateKey: string },
): Promise<RiskAssessment> {
  const message = messageRisk(input)
  const exce = scoreExce(input)
  const trend = trendRisk(await recentEntries(input.dateKey))
  const riskScore = clamp01(Math.max(message.score, message.score * 0.82 + trend.score))
  const riskLevel = riskLevelForScore(riskScore)
  return {
    riskScore,
    exceScore: exce.score,
    riskLevel,
    warningLevel: riskScore >= 0.35 ? 'warn' : 'none',
    flaggedTerms: message.flaggedTerms,
    reasons: unique([...message.reasons, ...trend.reasons, ...exce.hits.map((hit) => `positive: ${hit}`)]),
    source: 'local',
  }
}

function normalizeEnvToken(raw: string | undefined) {
  if (!raw) return undefined
  const t = raw.trim()
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1)
  }
  return t
}

function riskEndpoint() {
  const weeklyEndpoint = import.meta.env.VITE_WEEKLY_AI_ENDPOINT
  if (typeof weeklyEndpoint !== 'string' || !weeklyEndpoint.trim()) return null
  return normalizeEndpointUrl(weeklyEndpoint).replace(/\/weekly-summary\/?$/, '/risk-assessment')
}

function parseWorkerRisk(body: WorkerRiskResponse): Pick<RiskAssessment, 'riskScore' | 'riskLevel' | 'reasons' | 'supportiveMessage' | 'responseKind'> | null {
  const score = Number(body.riskScore)
  if (!Number.isFinite(score)) return null
  const riskLevel = body.riskLevel
  if (riskLevel !== 'none' && riskLevel !== 'low' && riskLevel !== 'elevated' && riskLevel !== 'crisis') {
    return null
  }
  const reasons = Array.isArray(body.reasons)
    ? body.reasons.filter((row): row is string => typeof row === 'string').slice(0, 4)
    : []
  return {
    riskScore: clamp01(score),
    riskLevel,
    reasons,
    supportiveMessage: typeof body.supportiveMessage === 'string' ? body.supportiveMessage : undefined,
    responseKind:
      body.responseKind === 'risk' || body.responseKind === 'support' || body.responseKind === 'celebration'
        ? body.responseKind
        : undefined,
  }
}

export async function refineRiskWithWorker(
  local: RiskAssessment,
  input: RiskAssessmentInput & { dateKey?: string },
  options: RiskAssessmentOptions = {},
): Promise<RiskAssessment> {
  if (
    !isAiEnabledLocally() ||
    import.meta.env.VITE_ENABLE_WEEKLY_AI_SUMMARY !== '1' ||
    (!options.forceAi && !shouldRequestAiRiskReview(local, input))
  ) {
    return local
  }
  const endpoint = riskEndpoint()
  const token = normalizeEnvToken(import.meta.env.VITE_WEEKLY_AI_TOKEN)
  if (!endpoint || !token) return local

  try {
    const controller = new AbortController()
    const supportMemories = await recentSupportMemories(input.dateKey)
    const timeout = window.setTimeout(() => controller.abort(), 7000)
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({
          localRiskScore: local.riskScore,
          localRiskLevel: local.riskLevel,
          localExceScore: local.exceScore,
          reasons: local.reasons,
          entry: {
            sentiment: input.sentiment,
            emotion: input.emotionNote || input.emotion,
            situation: input.situation,
            details: input.details,
          },
          supportMemories,
        }),
      })
      if (!response.ok) return local
      const parsed = parseWorkerRisk((await response.json()) as WorkerRiskResponse)
      if (!parsed) return local
      const riskScore = Math.max(
        local.riskScore,
        parsed.riskScore,
        minimumScoreForLevel(parsed.riskLevel),
      )
      const riskLevel = riskLevelForScore(riskScore)
      return {
        ...local,
        riskScore,
        riskLevel,
        warningLevel: riskScore >= 0.35 ? 'warn' : 'none',
        reasons: unique([...local.reasons, ...parsed.reasons]),
        supportiveMessage: parsed.supportiveMessage,
        responseKind:
          riskScore >= 0.35
            ? 'risk'
            : parsed.responseKind ?? (local.exceScore >= EXCE_AI_THRESHOLD ? 'celebration' : 'support'),
        source: 'hybrid',
      }
    } finally {
      window.clearTimeout(timeout)
    }
  } catch {
    return local
  }
}

export async function assessRisk(
  input: RiskAssessmentInput & { dateKey: string },
  options: RiskAssessmentOptions = {},
) {
  const local = await assessLocalRisk(input)
  return refineRiskWithWorker(local, input, options)
}

export function shouldRequestAiRiskReview(local: RiskAssessment, input: RiskAssessmentInput) {
  if (local.riskScore >= AI_RISK_REVIEW_THRESHOLD) return true
  if (local.exceScore >= EXCE_AI_THRESHOLD) return true
  const text = normalize(`${input.situation}\n${input.details}\n${input.emotionNote}`)
  if (!text || text.length < 12) return false
  if (input.sentiment === '-' && text.length >= 24 && local.riskScore >= 0.12) return true
  if (input.emotion === 'sad' || input.emotion === 'anxious' || input.emotion === 'angry') {
    return AI_REVIEW_TERMS.some((term) => text.includes(normalize(term)))
  }
  return AI_REVIEW_TERMS.some((term) => text.includes(normalize(term)))
}

export function flagConcerningLanguage(text: string) {
  const message = messageRisk({
    sentiment: '=',
    emotion: 'other',
    emotionNote: '',
    situation: '',
    details: text,
  })
  const riskScore = message.score
  return {
    flaggedTerms: message.flaggedTerms,
    warningLevel: riskScore >= 0.35 ? 'warn' as const : 'none' as const,
  }
}

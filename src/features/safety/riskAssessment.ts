import { format, parseISO, subDays } from 'date-fns'
import { getDb, type EntryEmotion, type EntryRow, type EntrySentiment, type RiskLevel } from '../../db/schema'
import { isDebugMode } from '../../shared/debug/debugFlags'
import { isAiEnabledLocally } from '../../shared/settings/appSettings'
import { scopedStorageKey } from '../../shared/storage/storageScope'
import { normalizeEndpointUrl } from '../compilation/weeklyAiSummary'

const CRISIS_TERMS = [
  'suicide',
  'suicidal',
  'end my life',
  'end it all',
  'want to die',
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

const AMBIGUOUS_RISK_TERMS = [
  'kill',
  'die',
  'want to disappear',
  'done',
  'i am done',
  "i'm done",
]

const SELF_HARM_TERMS = [
  'hurt myself',
  'self harm',
  'self-harm',
  'cut myself',
  'harm myself',
  'make it stop',
]

const CRISIS_MEDICATION_TERMS = ['overdose', 'took too many']
const MEDICATION_TERMS = ['pills', 'meds', 'medication']

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

const DISTRESS_TERMS = [
  'awful',
  'alone',
  'lonely',
  'terrible',
  'miserable',
  'struggling',
  'overwhelmed',
  'exhausted',
  'scared',
  'afraid',
  'crying',
  'broken',
]

const AI_REVIEW_TERMS = [
  ...CRISIS_TERMS,
  ...AMBIGUOUS_RISK_TERMS,
  ...SELF_HARM_TERMS,
  ...INTENSITY_TERMS,
  ...DISTRESS_TERMS,
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
  'aced',
  'crushed',
  'nailed',
  'killing it',
  'killed it',
  'killed this test',
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

const DEBUG_SENTINEL_PATTERN = /\bSENT_TRIGGER_(CRISIS|SUPPORT|EXEC|EXCE)(?:\(([^)]*)\))?/i

export type RiskAssessment = {
  riskScore: number
  interventionScore: number
  exceScore: number
  riskLevel: RiskLevel
  warningLevel: 'none' | 'warn'
  flaggedTerms: string[]
  reasons: string[]
  supportiveMessage?: string
  responseKind: 'none' | 'positive' | 'support' | 'crisis'
  crisisConfirmed?: boolean
  source: 'local' | 'hybrid'
}

type RiskAssessmentOptions = {
  forceAi?: boolean
}

type WorkerRiskResponse = {
  riskScore?: unknown
  interventionScore?: unknown
  riskLevel?: unknown
  responseKind?: unknown
  reasons?: unknown
  supportiveMessage?: unknown
}

type SupportMemory = {
  id: string
  dateKey: string
  emotion: string
  situation: string
  details: string
  relevance: number
}

const USED_SUPPORT_MEMORY_KEY = scopedStorageKey('mentell.ai.supportMemory.used')
const MEMORY_STOP_WORDS = new Set([
  'about',
  'after',
  'again',
  'because',
  'being',
  'could',
  'feel',
  'feeling',
  'from',
  'have',
  'just',
  'like',
  'that',
  'this',
  'today',
  'with',
  'would',
])

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

function expandDebugRiskInput<T extends RiskAssessmentInput>(input: T): T {
  if (!isDebugMode()) return input
  const rawText = `${input.situation}\n${input.details}\n${input.emotionNote}`
  const match = rawText.match(DEBUG_SENTINEL_PATTERN)
  if (!match) return input

  const kind = match[1].toUpperCase()
  const reason = match[2]?.trim()
  if (kind === 'CRISIS') {
    const harmReason = reason || 'I am afraid I might hurt myself tonight'
    return {
      ...input,
      sentiment: '-',
      emotion: 'sad',
      emotionNote: harmReason,
      situation: 'I am scared I might not be safe with myself',
      details: `I want to hurt myself and I do not feel safe being alone. ${harmReason}.`,
    }
  }
  if (kind === 'SUPPORT') {
    const supportReason = reason || 'a hard conversation left me feeling small and overwhelmed'
    return {
      ...input,
      sentiment: '-',
      emotion: 'anxious',
      emotionNote: supportReason,
      situation: 'A difficult interaction is sitting heavily with me',
      details: `I feel overwhelmed and alone after ${supportReason}. I am not in danger, but I could use a kind support note.`,
    }
  }

  const positiveReason = reason || 'I worked hard and something finally went beautifully'
  return {
    ...input,
    sentiment: '+',
    emotion: 'happy',
    emotionNote: positiveReason,
    situation: 'A very good thing happened today',
    details: `I am proud and excited because ${positiveReason}. I feel grateful, hopeful, and like I am really killing it.`,
  }
}

function unique(values: string[]) {
  return Array.from(new Set(values))
}

function memoryTokens(value: string) {
  return unique(
    normalize(value)
      .split(/[^a-z0-9']+/)
      .filter((token) => token.length >= 4 && !MEMORY_STOP_WORDS.has(token)),
  )
}

function loadUsedSupportMemoryIds() {
  try {
    const raw = localStorage.getItem(USED_SUPPORT_MEMORY_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

function saveUsedSupportMemoryId(id: string) {
  const next = [id, ...loadUsedSupportMemoryIds().filter((usedId) => usedId !== id)].slice(0, 24)
  localStorage.setItem(USED_SUPPORT_MEMORY_KEY, JSON.stringify(next))
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0))
}

function clampInterventionScore(n: number) {
  return Math.min(3, Math.max(-3, Number.isFinite(n) ? n : 0))
}

function responseKindForIntervention(score: number): RiskAssessment['responseKind'] {
  if (score >= 2) return 'crisis'
  if (score > 0) return 'support'
  if (score <= -1) return 'positive'
  return 'none'
}

function riskScoreForIntervention(score: number) {
  return score > 0 ? clamp01(score / 2) : 0
}

function riskLevelForIntervention(score: number): RiskLevel {
  if (score >= 2) return 'crisis'
  return riskLevelForScore(riskScoreForIntervention(score))
}

export function riskLevelForScore(score: number): RiskLevel {
  if (score >= 0.75) return 'crisis'
  if (score >= 0.35) return 'elevated'
  if (score > 0) return 'low'
  return 'none'
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
  if (!text) {
    return {
      score: 0,
      interventionScore: 0,
      flaggedTerms: [] as string[],
      reasons: [] as string[],
      crisisConfirmed: false,
    }
  }

  const crisis = scoreTerms(text, CRISIS_TERMS, 2.2)
  const ambiguous = scoreTerms(text, AMBIGUOUS_RISK_TERMS, 0.7)
  const selfHarm = scoreTerms(text, SELF_HARM_TERMS, 2)
  const crisisMeds = scoreTerms(text, CRISIS_MEDICATION_TERMS, 2.1)
  const meds = scoreTerms(text, MEDICATION_TERMS, 0.7)
  const intensity = scoreTerms(text, INTENSITY_TERMS, 0.7)
  const distress = scoreTerms(text, DISTRESS_TERMS, 0.5)
  const reasons: string[] = []

  const crisisConfirmed = crisis.hits.length > 0 || selfHarm.hits.length > 0 || crisisMeds.hits.length > 0
  let interventionScore =
    crisis.score +
    selfHarm.score +
    crisisMeds.score +
    meds.score +
    intensity.score +
    distress.score +
    ambiguous.score
  if (input.sentiment === '-') interventionScore += 0.55
  if (input.sentiment === '=') interventionScore += 0.1
  if (input.emotion === 'sad') interventionScore += 0.45
  if (input.emotion === 'anxious') interventionScore += 0.4
  if (input.emotion === 'angry') interventionScore += 0.25
  if (crisisConfirmed) interventionScore = Math.max(interventionScore, 2.1)

  if (crisis.hits.length) reasons.push('crisis language')
  if (ambiguous.hits.length) reasons.push('ambiguous risk language')
  if (selfHarm.hits.length) reasons.push('self-harm language')
  if (crisisMeds.hits.length) reasons.push('overdose language')
  if (meds.hits.length) reasons.push('medication language')
  if (intensity.hits.length) reasons.push('high-intensity distress language')
  if (distress.hits.length) reasons.push('distress language')
  if (input.sentiment === '-' || input.emotion === 'sad' || input.emotion === 'anxious') {
    reasons.push('difficult mood signal')
  }

  const finalInterventionScore = clampInterventionScore(interventionScore)
  return {
    score: riskScoreForIntervention(finalInterventionScore),
    interventionScore: finalInterventionScore,
    flaggedTerms: unique([
      ...crisis.hits,
      ...ambiguous.hits,
      ...selfHarm.hits,
      ...crisisMeds.hits,
      ...meds.hits,
      ...intensity.hits,
      ...distress.hits,
    ]),
    reasons: unique(reasons),
    crisisConfirmed,
  }
}

async function recentEntries(dateKey: string) {
  const end = parseISO(dateKey)
  const startKey = format(subDays(end, 7), 'yyyy-MM-dd')
  return getDb().entries.where('dateKey').between(startKey, dateKey, true, true).toArray()
}

async function recentSupportMemories(
  dateKey: string | undefined,
  input: RiskAssessmentInput,
): Promise<SupportMemory[]> {
  if (!dateKey) return []
  const end = parseISO(dateKey)
  const startKey = format(subDays(end, 60), 'yyyy-MM-dd')
  const rows = await getDb().entries.where('dateKey').between(startKey, dateKey, true, true).toArray()
  const inputTokens = memoryTokens(`${input.situation}\n${input.details}\n${input.emotionNote}`)
  const usedIds = new Set(loadUsedSupportMemoryIds())
  return rows
    .filter((entry) => {
      if (entry.warningLevel === 'warn' || entry.riskLevel === 'crisis') return false
      return entry.sentiment === '+' || entry.emotion === 'happy' || entry.emotion === 'calm'
    })
    .map((entry) => {
      const candidateTokens = memoryTokens(`${entry.situation}\n${entry.details}\n${entry.emotionNote}`)
      const overlap = candidateTokens.filter((token) => inputTokens.includes(token)).length
      const ageDays = Math.max(0, Math.round((end.getTime() - parseISO(entry.dateKey).getTime()) / 86_400_000))
      const moodBoost = entry.emotion === 'calm' ? 1.1 : entry.emotion === 'happy' ? 1 : 0.5
      const reusePenalty = usedIds.has(entry.id) ? -8 : 0
      const relevance = overlap * 3 + moodBoost + Math.max(0, 2 - ageDays / 14) + reusePenalty
      return { entry, relevance }
    })
    .sort((a, b) => b.relevance - a.relevance || b.entry.createdAt - a.entry.createdAt)
    .slice(0, 3)
    .map(({ entry, relevance }) => ({
      id: entry.id,
      dateKey: entry.dateKey,
      emotion: entry.emotionNote || entry.emotion,
      situation: entry.situation.slice(0, 140),
      details: entry.details.slice(0, 220),
      relevance,
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
  input = expandDebugRiskInput(input)
  const message = messageRisk(input)
  const exce = scoreExce(input)
  const trend = trendRisk(await recentEntries(input.dateKey))
  let interventionScore = message.interventionScore
  if (!message.crisisConfirmed && exce.score >= EXCE_AI_THRESHOLD) {
    interventionScore = Math.min(interventionScore, -1 - (exce.score - EXCE_AI_THRESHOLD) * 0.15)
  }
  const responseKind = responseKindForIntervention(interventionScore)
  const riskScore = riskScoreForIntervention(interventionScore)
  const riskLevel = riskLevelForIntervention(interventionScore)
  const warningLevel = responseKind === 'support' || responseKind === 'crisis' ? 'warn' : 'none'
  return {
    riskScore,
    interventionScore,
    exceScore: exce.score,
    riskLevel,
    warningLevel,
    flaggedTerms: message.flaggedTerms,
    reasons: unique([
      ...message.reasons,
      ...(warningLevel === 'warn' ? trend.reasons : []),
      ...exce.hits.map((hit) => `positive: ${hit}`),
    ]),
    responseKind,
    crisisConfirmed: message.crisisConfirmed,
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

function parseWorkerRisk(body: WorkerRiskResponse): Pick<RiskAssessment, 'interventionScore' | 'reasons' | 'supportiveMessage' | 'responseKind'> | null {
  const interventionScore = Number(body.interventionScore)
  if (!Number.isFinite(interventionScore)) return null
  const responseKind = body.responseKind
  if (
    responseKind !== 'none' &&
    responseKind !== 'positive' &&
    responseKind !== 'support' &&
    responseKind !== 'crisis'
  ) {
    return null
  }
  const reasons = Array.isArray(body.reasons)
    ? body.reasons.filter((row): row is string => typeof row === 'string').slice(0, 4)
    : []
  let finalInterventionScore = clampInterventionScore(interventionScore)
  if (responseKind === 'crisis') finalInterventionScore = Math.max(finalInterventionScore, 2)
  if (responseKind === 'support') finalInterventionScore = Math.min(Math.max(finalInterventionScore, 0.5), 1.9)
  if (responseKind === 'positive') finalInterventionScore = Math.min(finalInterventionScore, -1)
  if (responseKind === 'none') finalInterventionScore = Math.abs(finalInterventionScore) < 1 ? 0 : finalInterventionScore
  return {
    interventionScore: finalInterventionScore,
    reasons,
    supportiveMessage: typeof body.supportiveMessage === 'string' ? body.supportiveMessage : undefined,
    responseKind,
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
    const supportMemories = await recentSupportMemories(input.dateKey, input)
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
          localInterventionScore: local.interventionScore,
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
      let interventionScore = parsed.interventionScore
      if (local.crisisConfirmed) interventionScore = Math.max(interventionScore, 2)
      const responseKind = responseKindForIntervention(interventionScore)
      const riskScore = riskScoreForIntervention(interventionScore)
      const riskLevel = riskLevelForIntervention(interventionScore)
      if (responseKind === 'support' && supportMemories[0]) {
        saveUsedSupportMemoryId(supportMemories[0].id)
      }
      return {
        ...local,
        riskScore,
        interventionScore,
        riskLevel,
        warningLevel: responseKind === 'support' || responseKind === 'crisis' ? 'warn' : 'none',
        reasons: unique([...local.reasons, ...parsed.reasons]),
        supportiveMessage: parsed.supportiveMessage,
        responseKind,
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
  input = expandDebugRiskInput(input)
  const local = await assessLocalRisk(input)
  return refineRiskWithWorker(local, input, options)
}

export function shouldRequestAiRiskReview(local: RiskAssessment, input: RiskAssessmentInput) {
  if (local.responseKind !== 'none') return true
  if (local.flaggedTerms.length > 0) return true
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
  const responseKind = responseKindForIntervention(message.interventionScore)
  return {
    flaggedTerms: message.flaggedTerms,
    warningLevel: responseKind === 'support' || responseKind === 'crisis' ? 'warn' as const : 'none' as const,
  }
}

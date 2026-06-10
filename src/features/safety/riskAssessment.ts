import { format, parseISO, subDays } from 'date-fns'
import { getDb, type EntryEmotion, type EntryRow, type EntrySentiment, type RiskLevel } from '../../db/schema'
import { isDebugMode } from '../../shared/debug/debugFlags'
import { isAiEnabledLocally } from '../../shared/settings/appSettings'
import { scopedStorageKey } from '../../shared/storage/storageScope'
import { normalizeEndpointUrl } from '../compilation/weeklyAiSummary'
import {
  scoreLiteralSentiment,
  type LiteralSentimentLabel,
  type LiteralSentimentScore,
} from './sentimentScorer'
import { scoreSemanticRisk, type SemanticRiskScore } from './semanticRiskScorer'

const CRISIS_TERMS = [
  'suicide',
  'suicidal',
  'kill myself',
  'killing myself',
  'going to kill myself',
  'gonna kill myself',
  'about to kill myself',
  'end my life',
  'end myself',
  'ending myself',
  'end it all',
  'want to die',
  'wanna die',
  'wish i was dead',
  'wish i were dead',
  'rather be dead',
  'not wake up',
  'never wake up',
  'sleep forever',
  'go to sleep forever',
  'final goodbye',
  'last goodbye',
  'goodbye forever',
  'this is my goodbye',
  'last note',
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
  'cannot stay safe',
  'not safe with myself',
  'not safe alone',
  'cant be alone',
  "can't be alone",
  'cannot be alone',
  'have a plan',
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
  'hurting myself',
  'going to hurt myself',
  'gonna hurt myself',
  'want to hurt myself',
  'need to hurt myself',
  'self harm',
  'self-harm',
  'cut myself',
  'cutting myself',
  'want to cut',
  'need to cut',
  'going to cut',
  'gonna cut',
  'cutting again',
  'cut again',
  'cutting urges',
  'urge to cut',
  'thoughts of cutting',
  'want to bleed',
  'make myself bleed',
  'harm myself',
  'harming myself',
  'want to harm myself',
  'need to harm myself',
  'burn myself',
  'scratch myself',
  'pick my skin',
  'picking my skin',
  'pull my hair',
  'pulling my hair',
  'want pain',
  'want to feel pain',
  'need pain',
  'need to feel pain',
  'pain feels good',
  'hurt feels good',
  'hurting feels good',
  'feels good to hurt',
  'feels good to be hurt',
  'make myself hurt',
  'make it hurt',
  'make it stop',
]

const CRISIS_MEDICATION_TERMS = ['overdose', 'overdosing', 'took too many', 'take too many pills']
const OTHER_HARM_TERMS = [
  'kill someone',
  'kill somebody',
  'kill a person',
  'kill people',
  'kill others',
  'hurt someone',
  'hurt somebody',
  'hurt others',
  'hurt them',
  'hurt him',
  'hurt her',
  'murder someone',
  'murder somebody',
  'murder them',
  'murder him',
  'murder her',
  'harm someone',
  'harm somebody',
  'harm them',
  'attack someone',
  'attack somebody',
  'kill him',
  'kill her',
  'kill them',
  'kill my boss',
  'kill my teacher',
  'attack them',
  'attack him',
  'attack her',
  'beat him',
  'beat her',
  'beat them',
  'make them pay',
  'bring a weapon',
]
const RASH_ACTION_TERMS = [
  'do something stupid',
  'do something i regret',
  "do something i'll regret",
  'make a rash decision',
  'ruin my life',
  'throw everything away',
  'quit my job right now',
  'run away tonight',
  'drive off',
  'crash my car',
  'take harsh action',
  'harsh action',
  'move all my money',
  'send all my money',
  'spend all my money',
  'empty my bank account',
  'drain my savings',
  'gamble everything',
  'sell everything',
  'max out my credit cards',
  'quit everything',
]
const LIFE_ENDING_METAPHOR_PATTERNS = [
  /\b(?:end|ending|close|closing|finish|finishing)\s+(?:the\s+)?(?:story|book|chapter)\s+(?:that\s+is\s+)?(?:my\s+)?life\b/,
  /\b(?:my\s+)?life\s+(?:story|book|chapter)\s+(?:ends|is\s+ending|ends\s+tonight|ends\s+today)\b/,
]
const OTHER_HARM_PATTERNS = [
  /\b(?:going\s+to|gonna|about\s+to|want\s+to|need\s+to|might|could|will|im\s+going\s+to|i'm\s+going\s+to)\s+(?:hurt|harm|attack|stab|shoot|beat|kill|murder)\s+(?:my\s+|a\s+|the\s+)?(?:someone|somebody|person|people|others|them|him|her|friend|partner|coworker|boss|teacher|classmate|roommate|parent|mom|dad|mother|father|sibling|brother|sister)\b/,
  /\b(?:hurt|harm|attack|stab|shoot|beat|kill|murder)\s+(?:my\s+|a\s+|the\s+)?(?:someone|somebody|person|people|others|them|him|her|friend|partner|coworker|boss|teacher|classmate|roommate|parent|mom|dad|mother|father|sibling|brother|sister)\b/,
  /\b(?:this|their|his|her)\s+breath\s+(?:will\s+be\s+)?(?:(?:his|her|their)\s+|the\s+)?(?:last|final)\b/,
  /\b[a-z][a-z'-]{1,24}\s+(?:will\s+not|won't|wont)\s+(?:see|make\s+it\s+to)\s+(?:tomorrow|tonight|morning)\b/,
]
const SELF_HARM_PATTERNS = [
  /\b(?:going\s+to|gonna|about\s+to|want\s+to|need\s+to|might|could|will|plan\s+to|planning\s+to|im\s+going\s+to|i'm\s+going\s+to)\s+(?:hurt|harm|cut|burn|scratch|pick|pull|bleed|kill|end)\s+(?:myself|me|my\s+skin|my\s+hair)?\b/,
  /\b(?:hurt|harm|cut|burn|scratch|pick|bleed|kill|end)\s+(?:myself|me|my\s+skin)\b/,
  /\b(?:pull|pulling)\s+(?:my\s+)?hair\b/,
  /\b(?:cutting|burning|scratching|picking|pulling)\s+(?:myself|my\s+skin|my\s+hair|again|tonight|now)\b/,
  /\b(?:i\s+am|i'm|im|i\s+feel|feeling|felt|want|need|urge|urges|thoughts?|thinking)\b.{0,56}\b(?:pain|hurt|hurting|cutting|cut|burning|burn|scratching|scratch|picking|pick|pulling|pull|bleeding|bleed)\b/,
  /\b(?:pain|hurt(?:ing)?|bleeding|burning|cutting|scratching|picking|pulling)\s+(?:feels?|felt)\s+good\b/,
  /\b(?:feels?|felt)\s+good\s+to\s+(?:hurt|bleed|burn|cut|scratch|pick|pull)\b/,
  /\b(?:razor|blade|knife|lighter|cigarette|needle)\b.*\b(?:cut|hurt|harm|bleed|burn|scratch|myself)\b/,
]
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

const SUPPORT_TERMS = [
  'useless',
  'worthless',
  'worthlessness',
  'worthlesness',
  'worthelessness',
  'worthelesness',
  'i am a failure',
  "i'm a failure",
  'feel like a failure',
  'i hate myself',
  'hate myself',
  'hate who i am',
  'bad about myself',
  'not good enough',
  'never good enough',
  'weak self image',
  'weak self-image',
  'i am weak',
  "i'm weak",
  'feel weak',
  'i feel weak',
  'pathetic',
  'disgusting',
  'gross',
  'unlovable',
  'ugly',
  'fat',
  'unattractive',
  'hideous',
  'repulsive',
  'nobody could love me',
  'no one could love me',
  'no one will love me',
  'nobody will love me',
  'never get a boyfriend',
  'never get a girlfriend',
  'never get a partner',
  'unappreciated',
  'not appreciated',
  'demotivated',
  'hate my body',
  'hate my face',
  'bad body image',
  'body image',
  'ashamed of myself',
  'cant do anything right',
  "can't do anything right",
  'cannot do anything right',
  'everything is my fault',
  'i am a burden',
  "i'm a burden",
  'feel like a burden',
  'no one supports me',
  'nobody supports me',
  'no support',
  'unsupported',
  'feel unsupported',
  'feeling unsupported',
  'no one cares',
  'nobody cares',
  'ignored',
  'abandoned',
  'all alone',
  'really bad day',
  'worst day',
  'horrible day',
  'awful day',
  'falling apart',
  'cant catch a break',
  "can't catch a break",
]

const SUPPORT_PATTERNS = [
  /\b(?:i\s+am|i'm|im|i\s+feel|feeling|felt)\s+(?:so\s+|really\s+|very\s+)?(?:useless|worthless|weak|unlovable|broken|pathetic|disgusting|gross|ugly|fat|unattractive|hideous|repulsive|hopeless)\b/,
  /\b(?:i\s+hate|hate)\s+(?:myself|who\s+i\s+am|being\s+me)\b/,
  /\b(?:i\s+hate|hate)\s+(?:my\s+)?(?:body|face|looks|appearance)\b/,
  /\b(?:my\s+)?(?:body|face|looks|appearance)\s+(?:is|are|feels?|looks?)\s+(?:ugly|fat|gross|disgusting|unattractive|hideous|repulsive|awful|terrible)\b/,
  /\b(?:my\s+)?self[-\s]?image\s+(?:is\s+)?(?:awful|terrible|weak|bad|broken)\b/,
  /\b(?:no\s+one|nobody)\s+(?:supports|cares|listens|understands)\s+(?:about\s+)?(?:me)?\b/,
  /\b(?:i\s+feel|feeling|felt)\s+(?:so\s+|really\s+|very\s+)?(?:unsupported|ignored|alone|abandoned)\b/,
  /\b(?:everything|all\s+of\s+this)\s+(?:is\s+)?(?:my\s+fault|falling\s+apart)\b/,
]

const AI_REVIEW_TERMS = [
  ...CRISIS_TERMS,
  ...AMBIGUOUS_RISK_TERMS,
  ...SELF_HARM_TERMS,
  ...OTHER_HARM_TERMS,
  ...RASH_ACTION_TERMS,
  ...INTENSITY_TERMS,
  ...DISTRESS_TERMS,
  ...SUPPORT_TERMS,
  'i am done',
  "i'm done",
  'done with everything',
  'too much',
  'last straw',
  'no way out',
  'give up',
  'giving up',
  'murder',
  'weapon',
  'hurt',
  'harm',
  'stab',
  'shoot',
  'cut',
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
  'friend',
  'friends',
  'new friends',
  'made friends',
  'made new friends',
  'safe',
  'calm',
  'peaceful',
  'accomplished',
  'finally',
  'found',
  'fit',
  'clothes that fit',
  'nothing could be better',
  'best day',
  'breakthrough',
  'milestone',
  'succeeded',
  'success',
  'did it',
  'win',
  'celebrate',
  'aced',
  'crushed',
  'nailed',
  'killing it',
  'killed it',
  'killed this test',
]

const NEGATIVE_SUPPORT_THRESHOLD = 0.85
const SEMANTIC_SUPPORT_THRESHOLD = 0.9
export const EXCE_AI_THRESHOLD = 4

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
  literalSentimentLabel: LiteralSentimentLabel
  literalSentimentConfidence: number
  literalSentimentScore: number
  sentimentModelSource: LiteralSentimentScore['source']
  guardSafe?: boolean
  guardCategories?: string[]
  semanticRiskLabel: SemanticRiskScore['label']
  semanticRiskConfidence: number
  semanticRiskSource: SemanticRiskScore['source']
  source: 'local' | 'hybrid'
}

type RiskAssessmentOptions = {
  forceAi?: boolean
}

type WorkerRiskResponse = {
  guardSafe?: unknown
  guardCategories?: unknown
  literalSentimentLabel?: unknown
  literalSentimentConfidence?: unknown
  literalSentimentScore?: unknown
  sentimentModelSource?: unknown
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
  if (score <= -1) return 'positive'
  if (score >= NEGATIVE_SUPPORT_THRESHOLD) return 'support'
  return 'none'
}

function riskScoreForIntervention(score: number) {
  return score >= 2 ? clamp01(score / 2) : 0
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

function scorePatterns(normalized: string, patterns: RegExp[], label: string, weight: number) {
  const hits = patterns.some((pattern) => pattern.test(normalized)) ? [label] : []
  return { hits, score: hits.length ? weight : 0 }
}

function textForSentiment(input: RiskAssessmentInput) {
  return `${input.situation}\n${input.details}\n${input.emotionNote}`
}

function hasConcreteDangerContext(text: string) {
  return /\b(?:kill|murder|hurt|harm|attack|stab|shoot|beat|weapon|gun|knife|blood|dead|die|death|last\s+breath|final\s+breath|(?:his|her|their|this)\s+breath\s+(?:will\s+be\s+)?(?:(?:his|her|their)\s+|the\s+)?(?:last|final)|won't\s+see\s+tomorrow|wont\s+see\s+tomorrow|will\s+not\s+see\s+tomorrow|suicide|suicidal|overdose|self-?harm|cant\s+stay\s+safe|can't\s+stay\s+safe|not\s+safe)\b/.test(text)
}

function isBenignRoutineOrIdiom(text: string) {
  const householdTask =
    /\b(?:take|taking|took)\s+out\s+(?:the\s+)?(?:trash|garbage|recycling|compost)\b/.test(text) ||
    /\b(?:clean|cleaning|wash|washing|do|doing)\s+(?:the\s+)?(?:dishes|laundry|floors|bathroom|kitchen|sink|counters?)\b/.test(text) ||
    /\b(?:vacuum|vacuuming|sweep|sweeping|mop|mopping|fold|folding)\s+(?:the\s+)?(?:floor|floors|laundry|clothes|room|house|apartment)\b/.test(text)
  const takeOutIdiom =
    /\b(?:take|taking|took)\s+(?:(?:my|the|a|an|our|his|her|their)\s+)?[\w'-]+\s+out\b/.test(text) ||
    /\b(?:take|taking|took)\s+out\s+(?:(?:my|the|a|an|our|his|her|their)\s+)?[\w'-]+\b/.test(text)
  return (householdTask || takeOutIdiom) && !hasConcreteDangerContext(text)
}

function isBenignLowSignalMood(text: string) {
  if (hasConcreteDangerContext(text)) return false
  const words = text.match(/[a-z']+/g) ?? []
  if (words.length === 0 || words.length > 10) return false
  const allowed = new Set([
    'i',
    "i'm",
    'im',
    'am',
    'feel',
    'feeling',
    'felt',
    'just',
    'a',
    'bit',
    'little',
    'kind',
    'of',
    'sort',
    'today',
    'tonight',
    'okay',
    'ok',
    'fine',
    'alright',
    'sad',
    'sick',
    'ill',
    'unwell',
    'nauseous',
    'nauseated',
    'queasy',
    'feverish',
    'hurting',
    'sore',
    'achy',
    'tired',
    'exhausted',
    'drained',
    'angry',
    'mad',
    'upset',
    'anxious',
    'stressed',
    'overwhelmed',
    'mixed',
    'meh',
    'down',
    'low',
    'lonely',
    'blah',
  ])
  return words.every((word) => allowed.has(word))
}

function shouldSuppressSemanticRisk(text: string, message: ReturnType<typeof messageRisk>) {
  return !message.crisisConfirmed && (isBenignRoutineOrIdiom(text) || isBenignLowSignalMood(text))
}

function hasMeaningfulAssessmentText(text: string) {
  const words = text.match(/[a-z0-9']+/g) ?? []
  return words.length >= 2 || (words[0]?.length ?? 0) >= 4
}

function scoreExce(input: RiskAssessmentInput) {
  const text = normalize(`${input.situation}\n${input.details}\n${input.emotionNote}`)
  if (!hasMeaningfulAssessmentText(text)) return { score: 0, hits: [] as string[] }
  let score = 0
  const hits = EXCE_TERMS.filter((term) => text.includes(normalize(term)))
  score += hits.length
  if (input.sentiment === '+') score += 2
  if (input.emotion === 'happy') score += 2
  if (input.emotion === 'calm') score += 1
  return { score, hits: unique(hits) }
}

function scoreSupport(input: RiskAssessmentInput) {
  const text = normalize(textForSentiment(input))
  const terms = scoreTerms(text, SUPPORT_TERMS, 0.92)
  const patterns = scorePatterns(text, SUPPORT_PATTERNS, 'self-worth distress', 0.92)
  const hits = unique([...terms.hits, ...patterns.hits])
  return {
    score: hits.length ? Math.max(terms.score, patterns.score, SEMANTIC_SUPPORT_THRESHOLD) : 0,
    hits,
  }
}

function messageRisk(input: RiskAssessmentInput) {
  const text = normalize(textForSentiment(input))
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
  const lifeEndingMetaphor = scorePatterns(text, LIFE_ENDING_METAPHOR_PATTERNS, 'life-ending metaphor', 2.1)
  const selfHarm = scoreTerms(text, SELF_HARM_TERMS, 2)
  const crisisMeds = scoreTerms(text, CRISIS_MEDICATION_TERMS, 2.1)
  const otherHarm = scoreTerms(text, OTHER_HARM_TERMS, 2.1)
  const otherHarmPattern = scorePatterns(text, OTHER_HARM_PATTERNS, 'targeted harm language', 2.1)
  const selfHarmPattern = scorePatterns(text, SELF_HARM_PATTERNS, 'self-directed harm language', 2.1)
  const rashAction = scoreTerms(text, RASH_ACTION_TERMS, 1.9)
  const reasons: string[] = []

  const crisisConfirmed =
    crisis.hits.length > 0 ||
    lifeEndingMetaphor.hits.length > 0 ||
    selfHarm.hits.length > 0 ||
    selfHarmPattern.hits.length > 0 ||
    crisisMeds.hits.length > 0 ||
    otherHarm.hits.length > 0 ||
    otherHarmPattern.hits.length > 0 ||
    rashAction.hits.length > 0
  let interventionScore =
    crisis.score +
    lifeEndingMetaphor.score +
    selfHarm.score +
    selfHarmPattern.score +
    crisisMeds.score +
    otherHarm.score +
    otherHarmPattern.score +
    rashAction.score
  if (crisisConfirmed) interventionScore = Math.max(interventionScore, 2.1)

  if (crisis.hits.length || lifeEndingMetaphor.hits.length) reasons.push('crisis language')
  if (selfHarm.hits.length || selfHarmPattern.hits.length) reasons.push('self-harm language')
  if (otherHarm.hits.length || otherHarmPattern.hits.length) reasons.push('other-harm language')
  if (crisisMeds.hits.length) reasons.push('overdose language')
  if (rashAction.hits.length) reasons.push('rash action language')

  const finalInterventionScore = clampInterventionScore(interventionScore)
  return {
    score: riskScoreForIntervention(finalInterventionScore),
    interventionScore: finalInterventionScore,
    flaggedTerms: unique([
      ...crisis.hits,
      ...lifeEndingMetaphor.hits,
      ...selfHarm.hits,
      ...selfHarmPattern.hits,
      ...otherHarm.hits,
      ...otherHarmPattern.hits,
      ...crisisMeds.hits,
      ...rashAction.hits,
    ]),
    reasons: unique(reasons),
    crisisConfirmed,
  }
}

export function debugAssessLocalMessageRisk(text: string) {
  return messageRisk({
    sentiment: '=',
    emotion: 'other',
    emotionNote: '',
    situation: '',
    details: text,
  })
}

function applyLiteralSentiment(
  message: ReturnType<typeof messageRisk>,
  literalSentiment: LiteralSentimentScore,
  semanticRisk: SemanticRiskScore,
  supportScore: number,
  heatScore: number,
  exceScore: number,
  suppressSemanticRisk: boolean,
) {
  if (message.crisisConfirmed) return message.interventionScore
  if (suppressSemanticRisk) return 0
  if (exceScore >= EXCE_AI_THRESHOLD) {
    return Math.min(-1, -0.85 - (exceScore - EXCE_AI_THRESHOLD) * 0.15)
  }
  if (semanticRisk.positiveScore >= 0.7 && semanticRisk.crisisScore < 0.45) return -1
  if (literalSentiment.literalScore <= -0.85 && exceScore >= 2) {
    return Math.min(-1, literalSentiment.literalScore)
  }
  if (supportScore >= SEMANTIC_SUPPORT_THRESHOLD) return supportScore
  if (heatScore >= 0.48 && (supportScore > 0 || semanticRisk.supportScore >= 0.6 || literalSentiment.literalScore >= 0.7)) {
    return SEMANTIC_SUPPORT_THRESHOLD
  }
  if (semanticRisk.supportScore >= SEMANTIC_SUPPORT_THRESHOLD && semanticRisk.crisisScore < 0.35) {
    return semanticRisk.supportScore
  }
  return 0
}

function localCrisisFallbackMessage(input: RiskAssessmentInput, message: ReturnType<typeof messageRisk>) {
  if (!message.crisisConfirmed) return undefined
  const context = input.situation.trim() || input.details.trim() || input.emotionNote.trim()
  const anchor = context ? `This entry sounds urgent around "${context.slice(0, 120)}." ` : ''
  const reasonText = message.reasons.join(' ')
  if (reasonText.includes('other-harm')) {
    return `${anchor}Because it mentions possibly hurting someone else, put distance between you and the situation before doing anything else. Step away, get cold water on your hands or face, move your body hard for a minute, write the message you will not send, and contact a safe person now. If anyone may be in immediate danger, call emergency services.`
  }
  if (reasonText.includes('self-harm') || reasonText.includes('crisis') || reasonText.includes('overdose')) {
    return `${anchor}Because it points toward hurting yourself or not staying safe, move closer to another person and farther from anything you could use to act on this. Try one grounding thing you can do right now, like naming five objects nearby or putting on something comforting, and contact 988 or a trusted person if the urge is close.`
  }
  if (reasonText.includes('rash action')) {
    return `${anchor}Because it sounds like you may be about to make a decision you could regret, slow the next ten minutes down. Delay the action, leave the trigger if you can, write the choice down without doing it, and ask one steady person to sit with you before you decide.`
  }
  return `${anchor}This sounds like a moment that needs support before action. Pause, get near someone safe, put distance between you and anything risky, and contact emergency services or 988 if anyone could be in danger.`
}

function isHardCrisisReason(reasons: string[]) {
  return reasons.some((reason) =>
    reason === 'self-harm language' ||
    reason === 'other-harm language' ||
    reason === 'overdose language' ||
    reason === 'rash action language',
  )
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

function trendHeat(entries: EntryRow[]) {
  const recent = entries.slice(-14)
  let heat = 0
  let swings = 0
  let previousPolarity: 'positive' | 'negative' | null = null
  for (const entry of recent) {
    const risk = entry.riskLevel === 'crisis' || entry.warningLevel === 'warn'
    const negative = entry.sentiment === '-' || entry.emotion === 'sad' || entry.emotion === 'anxious' || entry.emotion === 'angry'
    const positive = entry.sentiment === '+' || entry.emotion === 'happy' || entry.emotion === 'calm'
    if (risk) heat += 2
    else if (negative) heat += 0.7
    if (positive) heat -= 0.85
    const polarity = positive ? 'positive' : negative ? 'negative' : null
    if (polarity && previousPolarity && polarity !== previousPolarity) swings += 1
    if (polarity) previousPolarity = polarity
    heat = Math.max(0, heat * 0.92)
  }
  const reasons: string[] = []
  if (heat >= 2.4) reasons.push('support heat: repeated difficult entries')
  if (swings >= 4) reasons.push('mood swing context')
  return { heat: clamp01(heat / 5), reasons }
}

export async function assessLocalRisk(
  input: RiskAssessmentInput & { dateKey: string },
): Promise<RiskAssessment> {
  input = expandDebugRiskInput(input)
  const message = messageRisk(input)
  const exce = scoreExce(input)
  const support = scoreSupport(input)
  const entries = await recentEntries(input.dateKey)
  const trend = trendRisk(entries)
  const heat = trendHeat(entries)
  const assessmentText = textForSentiment(input)
  const normalizedAssessmentText = normalize(assessmentText)
  const suppressSemanticRisk = shouldSuppressSemanticRisk(normalizedAssessmentText, message)
  const [literalSentiment, semanticRisk] = await Promise.all([
    scoreLiteralSentiment(assessmentText),
    scoreSemanticRisk(assessmentText),
  ])
  const interventionScore = applyLiteralSentiment(
    message,
    literalSentiment,
    semanticRisk,
    support.score,
    heat.heat,
    exce.score,
    suppressSemanticRisk,
  )
  const responseKind = responseKindForIntervention(interventionScore)
  const riskScore = riskScoreForIntervention(interventionScore)
  const riskLevel = riskLevelForIntervention(interventionScore)
  const warningLevel = responseKind === 'crisis' ? 'warn' : 'none'
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
      ...(literalSentiment.source === 'model'
        ? [`sentiment: ${literalSentiment.label.toLowerCase()} ${literalSentiment.confidence.toFixed(2)}`]
        : []),
      ...(semanticRisk.source === 'model'
        ? [`semantic: ${semanticRisk.label} ${semanticRisk.confidence.toFixed(2)}`]
        : []),
      ...(suppressSemanticRisk ? ['semantic suppressed: benign low-signal entry'] : []),
      ...heat.reasons,
      ...support.hits.map((hit) => `support: ${hit}`),
      ...exce.hits.map((hit) => `positive: ${hit}`),
    ]),
    supportiveMessage:
      responseKind === 'crisis'
        ? localCrisisFallbackMessage(input, message)
        : undefined,
    responseKind,
    crisisConfirmed: message.crisisConfirmed,
    literalSentimentLabel: literalSentiment.label,
    literalSentimentConfidence: literalSentiment.confidence,
    literalSentimentScore: literalSentiment.literalScore,
    sentimentModelSource: literalSentiment.source,
    semanticRiskLabel: semanticRisk.label,
    semanticRiskConfidence: semanticRisk.confidence,
    semanticRiskSource: semanticRisk.source,
    source: 'local',
  }
}

export function assessDraftRisk(input: RiskAssessmentInput): Pick<
  RiskAssessment,
  'riskScore' | 'warningLevel' | 'flaggedTerms' | 'reasons'
> {
  const message = messageRisk(input)
  const warningLevel = message.crisisConfirmed ? 'warn' as const : 'none' as const
  return {
    riskScore: message.score,
    warningLevel,
    flaggedTerms: message.flaggedTerms,
    reasons: message.reasons,
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

function parseWorkerRisk(body: WorkerRiskResponse): Pick<
  RiskAssessment,
  | 'interventionScore'
  | 'reasons'
  | 'supportiveMessage'
  | 'responseKind'
  | 'guardSafe'
  | 'guardCategories'
  | 'literalSentimentLabel'
  | 'literalSentimentConfidence'
  | 'literalSentimentScore'
  | 'sentimentModelSource'
> | null {
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
  const guardCategories = Array.isArray(body.guardCategories)
    ? body.guardCategories.filter((row): row is string => typeof row === 'string').slice(0, 6)
    : []
  const literalSentimentLabel =
    body.literalSentimentLabel === 'POSITIVE' || body.literalSentimentLabel === 'NEGATIVE'
      ? body.literalSentimentLabel
      : 'NEUTRAL'
  const literalSentimentConfidence = clamp01(Number(body.literalSentimentConfidence))
  const literalSentimentScore = clampInterventionScore(Number(body.literalSentimentScore))
  const sentimentModelSource =
    body.sentimentModelSource === 'worker' || body.sentimentModelSource === 'fallback'
      ? body.sentimentModelSource
      : 'fallback'
  let finalInterventionScore = clampInterventionScore(interventionScore)
  if (responseKind === 'crisis') finalInterventionScore = Math.max(finalInterventionScore, 2)
  if (responseKind === 'positive') finalInterventionScore = Math.min(finalInterventionScore, -1)
  return {
    interventionScore: finalInterventionScore,
    reasons,
    supportiveMessage: typeof body.supportiveMessage === 'string' ? body.supportiveMessage : undefined,
    responseKind,
    guardSafe: typeof body.guardSafe === 'boolean' ? body.guardSafe : undefined,
    guardCategories,
    literalSentimentLabel,
    literalSentimentConfidence,
    literalSentimentScore,
    sentimentModelSource,
  }
}

export async function refineRiskWithWorker(
  local: RiskAssessment,
  input: RiskAssessmentInput & { dateKey?: string },
  options: RiskAssessmentOptions = {},
): Promise<RiskAssessment> {
  const text = normalize(`${input.situation}\n${input.details}\n${input.emotionNote}`)
  if (!options.forceAi && !hasMeaningfulAssessmentText(text)) return local
  const aiConfigured = import.meta.env.VITE_ENABLE_WEEKLY_AI_SUMMARY === '1'
  const wantsWorker =
    options.forceAi ||
    (aiConfigured && local.responseKind !== 'none') ||
    (isAiEnabledLocally() && aiConfigured && shouldRequestLlamaGuard(local, input))
  if (!wantsWorker) return local
  const endpoint = riskEndpoint()
  const token = normalizeEnvToken(import.meta.env.VITE_WEEKLY_AI_TOKEN)
  if (!endpoint || !token) {
    return options.forceAi
      ? {
          ...local,
          reasons: unique([
            ...local.reasons,
            !endpoint ? 'worker skipped: VITE_WEEKLY_AI_ENDPOINT missing' : '',
            !token ? 'worker skipped: VITE_WEEKLY_AI_TOKEN missing' : '',
          ].filter(Boolean)),
        }
      : local
  }

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
          localResponseKind: local.responseKind,
          localExceScore: local.exceScore,
          localLiteralSentimentLabel: local.literalSentimentLabel,
          localLiteralSentimentConfidence: local.literalSentimentConfidence,
          localLiteralSentimentScore: local.literalSentimentScore,
          localSemanticRiskLabel: local.semanticRiskLabel,
          localSemanticRiskConfidence: local.semanticRiskConfidence,
          localSemanticRiskSource: local.semanticRiskSource,
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
      const hardLocalCrisis = local.crisisConfirmed && isHardCrisisReason(local.reasons)
      const responseKind = parsed.guardSafe === false || hardLocalCrisis
        ? 'crisis'
        : parsed.responseKind === 'crisis' ||
            parsed.responseKind === 'positive' ||
            parsed.responseKind === 'support' ||
            parsed.responseKind === 'none'
          ? parsed.responseKind
          : responseKindForIntervention(interventionScore)
      if (responseKind === 'crisis') interventionScore = Math.max(interventionScore, 2)
      if (responseKind === 'none') interventionScore = 0
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
        warningLevel: responseKind === 'crisis' ? 'warn' : 'none',
        reasons: unique([...local.reasons, ...parsed.reasons]),
        supportiveMessage:
          parsed.supportiveMessage ?? (responseKind === 'crisis' ? local.supportiveMessage : undefined),
        responseKind,
        guardSafe: parsed.guardSafe,
        guardCategories: parsed.guardCategories,
        literalSentimentLabel: parsed.literalSentimentLabel,
        literalSentimentConfidence: parsed.literalSentimentConfidence,
        literalSentimentScore: parsed.literalSentimentScore,
        sentimentModelSource: parsed.sentimentModelSource,
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
  return shouldRequestLlamaGuard(local, input)
}

export function shouldRequestLlamaGuard(local: RiskAssessment, input: RiskAssessmentInput) {
  if (local.crisisConfirmed) return true
  if (local.flaggedTerms.length > 0) return true
  if (local.exceScore >= EXCE_AI_THRESHOLD) return true
  const text = normalize(`${input.situation}\n${input.details}\n${input.emotionNote}`)
  if (!text || text.length < 12) return false
  if (shouldSuppressSemanticRisk(text, {
    score: local.riskScore,
    interventionScore: local.interventionScore,
    flaggedTerms: local.flaggedTerms,
    reasons: local.reasons,
    crisisConfirmed: Boolean(local.crisisConfirmed),
  })) return false
  if (
    (local.semanticRiskLabel === 'self_harm' || local.semanticRiskLabel === 'other_harm') &&
    local.semanticRiskConfidence >= 0.82
  ) {
    return true
  }
  if (local.semanticRiskLabel === 'rash_action' && local.semanticRiskConfidence >= 0.72) return true
  if (local.responseKind === 'support' || local.responseKind === 'positive') return true
  if (AI_REVIEW_TERMS.some((term) => text.includes(normalize(term)))) return true
  return false
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
    warningLevel: responseKind === 'crisis' ? 'warn' as const : 'none' as const,
  }
}

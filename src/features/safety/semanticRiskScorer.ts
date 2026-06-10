import { isDebugMode } from '../../shared/debug/debugFlags'

const MODEL = 'Xenova/mobilebert-uncased-mnli'
const MIN_MODEL_TEXT_LENGTH = 12

const LABELS = [
  'immediate risk of self-harm or suicide',
  'threat of violence toward another person',
  'rash unsafe action that could be regretted',
  'ordinary distress without immediate danger',
  'strong positive achievement joy or relief',
  'neutral everyday journal entry',
] as const

type SemanticLabel = (typeof LABELS)[number]

export type SemanticRiskScore = {
  label: 'self_harm' | 'other_harm' | 'rash_action' | 'support' | 'positive' | 'neutral'
  confidence: number
  crisisScore: number
  supportScore: number
  positiveScore: number
  source: 'model' | 'neutral' | 'fallback'
  raw: Array<{ label: string; score: number }>
  error?: string
}

type RawZeroShotResult = {
  labels?: unknown
  scores?: unknown
}

type ZeroShotClassifier = (
  text: string,
  labels: string[],
  options?: { multi_label?: boolean },
) => Promise<RawZeroShotResult>

let classifierPromise: Promise<ZeroShotClassifier> | null = null
let lastDebugScore: SemanticRiskScore | null = null

function neutral(source: SemanticRiskScore['source'], error?: string): SemanticRiskScore {
  return {
    label: 'neutral',
    confidence: 0,
    crisisScore: 0,
    supportScore: 0,
    positiveScore: 0,
    source,
    raw: [],
    ...(error ? { error } : {}),
  }
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
}

async function loadClassifier(): Promise<ZeroShotClassifier> {
  if (!classifierPromise) {
    classifierPromise = import('@xenova/transformers').then(async ({ env, pipeline }) => {
      env.allowLocalModels = false
      env.useBrowserCache = true
      return pipeline('zero-shot-classification', MODEL, { quantized: true }) as unknown as Promise<ZeroShotClassifier>
    })
  }
  return classifierPromise
}

function rowMap(result: RawZeroShotResult) {
  const labels = Array.isArray(result.labels) ? result.labels : []
  const scores = Array.isArray(result.scores) ? result.scores : []
  const rows = labels
    .map((label, index) => ({
      label: typeof label === 'string' ? label : '',
      score: clamp01(Number(scores[index])),
    }))
    .filter((row): row is { label: SemanticLabel; score: number } =>
      (LABELS as readonly string[]).includes(row.label),
    )
  return rows
}

function parseSemanticRisk(result: RawZeroShotResult): SemanticRiskScore {
  const rows = rowMap(result)
  const scoreFor = (label: SemanticLabel) => rows.find((row) => row.label === label)?.score ?? 0
  const selfHarm = scoreFor('immediate risk of self-harm or suicide')
  const otherHarm = scoreFor('threat of violence toward another person')
  const rashAction = scoreFor('rash unsafe action that could be regretted')
  const supportScore = scoreFor('ordinary distress without immediate danger')
  const positiveScore = scoreFor('strong positive achievement joy or relief')
  const neutralScore = scoreFor('neutral everyday journal entry')
  const crisisScore = Math.max(selfHarm, otherHarm, rashAction)
  const ordered = [
    { label: 'self_harm' as const, score: selfHarm },
    { label: 'other_harm' as const, score: otherHarm },
    { label: 'rash_action' as const, score: rashAction },
    { label: 'support' as const, score: supportScore },
    { label: 'positive' as const, score: positiveScore },
    { label: 'neutral' as const, score: neutralScore },
  ].sort((a, b) => b.score - a.score)

  return {
    label: ordered[0]?.label ?? 'neutral',
    confidence: ordered[0]?.score ?? 0,
    crisisScore,
    supportScore,
    positiveScore,
    source: 'model',
    raw: rows.sort((a, b) => b.score - a.score).slice(0, 6),
  }
}

export async function scoreSemanticRisk(text: string): Promise<SemanticRiskScore> {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length < MIN_MODEL_TEXT_LENGTH) {
    const score = neutral('neutral')
    if (isDebugMode()) lastDebugScore = score
    return score
  }

  try {
    const classifier = await loadClassifier()
    const score = parseSemanticRisk(await classifier(clean, [...LABELS], { multi_label: true }))
    if (isDebugMode()) lastDebugScore = score
    return score
  } catch (error) {
    const score = neutral('fallback', error instanceof Error ? error.message : String(error))
    if (isDebugMode()) lastDebugScore = score
    return score
  }
}

export function getLastSemanticRiskDebugScore() {
  return lastDebugScore
}

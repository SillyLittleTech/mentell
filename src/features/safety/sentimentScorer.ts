import { isDebugMode } from '../../shared/debug/debugFlags'

const MODEL = 'Xenova/distilbert-base-uncased-finetuned-sst-2-english'
const MIN_MODEL_TEXT_LENGTH = 3

export type LiteralSentimentLabel = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'

export type LiteralSentimentScore = {
  label: LiteralSentimentLabel
  confidence: number
  literalScore: number
  source: 'model' | 'worker' | 'neutral' | 'fallback'
  error?: string
}

type RawClassification = {
  label?: unknown
  score?: unknown
}

type Classifier = (text: string) => Promise<RawClassification | RawClassification[]>

let classifierPromise: Promise<Classifier> | null = null
let lastDebugScore: LiteralSentimentScore | null = null

function clamp01(value: number) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
}

function neutral(source: LiteralSentimentScore['source'], error?: string): LiteralSentimentScore {
  return {
    label: 'NEUTRAL',
    confidence: 0,
    literalScore: 0,
    source,
    ...(error ? { error } : {}),
  }
}

async function loadClassifier(): Promise<Classifier> {
  if (!classifierPromise) {
    classifierPromise = import('@xenova/transformers').then(async ({ env, pipeline }) => {
      env.allowLocalModels = false
      env.useBrowserCache = true
      return pipeline('sentiment-analysis', MODEL, { quantized: true }) as Promise<Classifier>
    })
  }
  return classifierPromise
}

function parseClassification(raw: RawClassification | RawClassification[]): LiteralSentimentScore {
  const row = Array.isArray(raw) ? raw[0] : raw
  const label = row?.label === 'POSITIVE' || row?.label === 'NEGATIVE' ? row.label : 'NEUTRAL'
  const confidence = clamp01(Number(row?.score))
  const literalScore = label === 'NEGATIVE' ? confidence : label === 'POSITIVE' ? -confidence : 0
  return { label, confidence, literalScore, source: 'model' }
}

export async function scoreLiteralSentiment(text: string): Promise<LiteralSentimentScore> {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length < MIN_MODEL_TEXT_LENGTH) {
    const score = neutral('neutral')
    if (isDebugMode()) lastDebugScore = score
    return score
  }

  try {
    const classifier = await loadClassifier()
    const score = parseClassification(await classifier(clean))
    if (isDebugMode()) lastDebugScore = score
    return score
  } catch (error) {
    const score = neutral('fallback', error instanceof Error ? error.message : String(error))
    if (isDebugMode()) lastDebugScore = score
    return score
  }
}

export function getLastLiteralSentimentDebugScore() {
  return lastDebugScore
}

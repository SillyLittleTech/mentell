import type { EntryRow } from '../../db/schema'

const HOUR_LIMIT = 24
const DAY_LIMIT = 80
const RATE_KEY = 'mentell.ai.weekly.rate'

type RateState = {
  timestamps: number[]
}

function readRateState(): RateState {
  try {
    const raw = localStorage.getItem(RATE_KEY)
    if (!raw) return { timestamps: [] }
    const parsed = JSON.parse(raw) as Partial<RateState>
    if (!Array.isArray(parsed.timestamps)) return { timestamps: [] }
    return { timestamps: parsed.timestamps.filter((n) => Number.isFinite(n)) as number[] }
  } catch {
    return { timestamps: [] }
  }
}

function writeRateState(state: RateState) {
  localStorage.setItem(RATE_KEY, JSON.stringify(state))
}

function consumeRateAllowance(now: number) {
  const state = readRateState()
  const hourAgo = now - 60 * 60 * 1000
  const dayAgo = now - 24 * 60 * 60 * 1000
  const recent = state.timestamps.filter((ts) => ts >= dayAgo)
  const hourCount = recent.filter((ts) => ts >= hourAgo).length
  const dayCount = recent.length

  if (hourCount >= HOUR_LIMIT) {
    return { ok: false as const, reason: `Hourly limit reached (${HOUR_LIMIT}/hour).` }
  }
  if (dayCount >= DAY_LIMIT) {
    return { ok: false as const, reason: `Daily limit reached (${DAY_LIMIT}/day).` }
  }

  recent.push(now)
  writeRateState({ timestamps: recent })
  return { ok: true as const }
}

export function weeklyAiSummaryEnabled() {
  return (
    import.meta.env.VITE_ENABLE_WEEKLY_AI_SUMMARY === '1' &&
    typeof import.meta.env.VITE_WEEKLY_AI_ENDPOINT === 'string' &&
    import.meta.env.VITE_WEEKLY_AI_ENDPOINT.length > 0
  )
}

export async function requestWeeklyAiSummary(entries: EntryRow[]) {
  if (!weeklyAiSummaryEnabled()) {
    throw new Error('AI summary is disabled.')
  }
  const allowance = consumeRateAllowance(Date.now())
  if (!allowance.ok) {
    throw new Error(allowance.reason)
  }

  const endpoint = import.meta.env.VITE_WEEKLY_AI_ENDPOINT as string
  const token = import.meta.env.VITE_WEEKLY_AI_TOKEN as string | undefined
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      entries: entries.map((entry) => ({
        dateKey: entry.dateKey,
        sentiment: entry.sentiment,
        emotion: entry.emotionNote || entry.emotion,
        situation: entry.situation,
        details: entry.details,
      })),
    }),
  })

  if (!response.ok) {
    throw new Error(`AI endpoint error (${response.status}).`)
  }

  const body = (await response.json()) as { summary?: string; error?: string }
  if (!body.summary) {
    throw new Error(body.error ?? 'AI endpoint did not return a summary.')
  }
  return { summary: body.summary }
}

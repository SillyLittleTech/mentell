import type { EntryRow } from '../../db/schema'
import { isAiEnabledLocally } from '../../shared/settings/appSettings'
import type { AiProfile } from './aiProfile'
import { sanitizeAiProfile } from './aiProfile'
import {
  getCachedWeeklySummary,
  setCachedWeeklySummary,
} from './weeklyAiCache'
import { weekKeyForDateKey } from './weeklyStats'

const HOUR_LIMIT = 24
const DAY_LIMIT = 80
const RATE_KEY = 'mentell.ai.weekly.rate'

export type AiSummaryMode = 'reflection' | 'overview'

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

/** Strip optional quotes; dotenv may leave them when values are quoted in .env.local */
function normalizeEnvToken(raw: string | undefined) {
  if (!raw) return undefined
  const t = raw.trim()
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1)
  }
  return t
}

export function weeklyAiSummaryEnabled() {
  return (
    isAiEnabledLocally() &&
    import.meta.env.VITE_ENABLE_WEEKLY_AI_SUMMARY === '1' &&
    typeof import.meta.env.VITE_WEEKLY_AI_ENDPOINT === 'string' &&
    import.meta.env.VITE_WEEKLY_AI_ENDPOINT.length > 0
  )
}

export async function requestWeeklyAiSummary(
  entries: EntryRow[],
  options: {
    mode: AiSummaryMode
    profile: AiProfile
    weekKey?: string
    skipCache?: boolean
  },
) {
  if (!weeklyAiSummaryEnabled()) {
    throw new Error('AI summary is disabled.')
  }

  const profile = sanitizeAiProfile(options.profile)
  const weekKey =
    options.weekKey ?? (entries[0] ? weekKeyForDateKey(entries[0].dateKey) : 'unknown')

  if (!options.skipCache) {
    const cached = getCachedWeeklySummary({
      weekKey,
      mode: options.mode,
      entries,
      profile,
    })
    if (cached) {
      return { summary: cached, fromCache: true as const }
    }
  }

  const allowance = consumeRateAllowance(Date.now())
  if (!allowance.ok) {
    throw new Error(allowance.reason)
  }

  const endpoint = import.meta.env.VITE_WEEKLY_AI_ENDPOINT as string
  const token = normalizeEnvToken(import.meta.env.VITE_WEEKLY_AI_TOKEN)
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      mode: options.mode,
      profile: {
        displayName: profile.displayName,
        ageRange: profile.ageRange,
        about: profile.about,
      },
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

  setCachedWeeklySummary({
    weekKey,
    mode: options.mode,
    entries,
    profile,
    summary: body.summary,
  })

  return { summary: body.summary, fromCache: false as const }
}

export function buildAiSummaryMarkdown(input: {
  weekKey: string
  startDateKey: string
  endDateKey: string
  mode: AiSummaryMode
  profile: AiProfile
  summary: string
}) {
  const profile = sanitizeAiProfile(input.profile)
  const lines = [
    '# Mentell weekly AI summary',
    '',
    `- Week: ${input.weekKey} (${input.startDateKey} → ${input.endDateKey})`,
    `- Mode: ${input.mode === 'overview' ? 'Narrative overview' : 'Reflection'}`,
    `- Generated: ${new Date().toISOString()}`,
    '',
  ]
  if (profile.displayName) lines.push(`- Name (for tone): ${profile.displayName}`)
  if (profile.ageRange && profile.ageRange !== 'prefer-not') {
    lines.push(`- Age range: ${profile.ageRange}`)
  }
  lines.push('', '---', '', input.summary, '')
  return lines.join('\n')
}

export function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

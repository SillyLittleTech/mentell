import type { EntryRow } from '../../db/schema'
import { getDb } from '../../db/schema'
import { isAiEnabledLocally, loadAppSettings } from '../../shared/settings/appSettings'
import { customProjectorSearchAnalytical, customProjectorSearchChat } from '../../lib/aiClient'
import { scopedStorageKey } from '../../shared/storage/storageScope'
import { getSkipSearchRateLimit } from '../../shared/debug/debugFlags'
import { normalizeEndpointUrl } from './weeklyAiSummary'

const HOUR_LIMIT = 12
const DAY_LIMIT = 40
const RATE_KEY = scopedStorageKey('mentell.ai.projectorSearch.rate')
const ANON_ID_KEY = scopedStorageKey('mentell.ai.projectorSearch.anonId')

export type ProjectorSearchMode = 'search' | 'chat' | 'index'

export type ProjectorSearchMessage = { role: 'user' | 'assistant' | 'system'; content: string }

export type ProjectorSearchEntry = Pick<
  EntryRow,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'dateKey'
  | 'sentiment'
  | 'emotion'
  | 'emotionNote'
  | 'situation'
  | 'details'
  | 'behavioursNoted'
  | 'reoccurringTheme'
  | 'flaggedTerms'
  | 'warningLevel'
  | 'riskScore'
  | 'interventionScore'
  | 'riskLevel'
  | 'scoreDelta'
  | 'streakAtSubmit'
>

export type ProjectorIndexStatus = 'synced' | 'skipped' | 'failed' | 'idle'

export type ProjectorSearchResult =
  | {
      type: 'entries'
      entryIds: string[]
      entries: ProjectorSearchEntry[]
      preamble?: string
      indexStatus?: ProjectorIndexStatus
    }
  | { type: 'answer'; text: string; indexStatus?: ProjectorIndexStatus }
  | { type: 'error'; message: string; indexStatus?: ProjectorIndexStatus }

type RateState = { timestamps: number[] }

function normalizeEnvToken(raw: string | undefined) {
  if (!raw) return undefined
  const t = raw.trim()
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1)
  }
  return t
}

export function projectorSearchEnabled() {
  const settings = loadAppSettings()
  if (settings.aiProvider === 'custom') {
    return isAiEnabledLocally() && settings.aiBaseUrl.trim().length > 0
  }
  return (
    isAiEnabledLocally() &&
    import.meta.env.VITE_ENABLE_PROJECTOR_AI_SEARCH === '1' &&
    typeof import.meta.env.VITE_PROJECTOR_SEARCH_ENDPOINT === 'string' &&
    import.meta.env.VITE_PROJECTOR_SEARCH_ENDPOINT.length > 0
  )
}

function localMatchEntries(entries: ProjectorSearchEntry[], query: string) {
  const q = query.toLowerCase()
  return entries.filter(
    (e) =>
      e.situation?.toLowerCase().includes(q) ||
      e.details?.toLowerCase().includes(q) ||
      e.behavioursNoted?.toLowerCase().includes(q) ||
      e.reoccurringTheme?.toLowerCase().includes(q),
  )
}

export function getProjectorSearchEndpoint() {
  const raw = import.meta.env.VITE_PROJECTOR_SEARCH_ENDPOINT as string | undefined
  return raw ? normalizeEndpointUrl(raw) : ''
}

export function getOrCreateAnonSearchUserId() {
  try {
    const existing = localStorage.getItem(ANON_ID_KEY)
    if (existing) return existing
    const id = `anon_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
    localStorage.setItem(ANON_ID_KEY, id)
    return id
  } catch {
    return 'anon_local'
  }
}

export function buildIndexDigest(entries: Array<{ id: string; updatedAt?: number; createdAt?: number }>) {
  const parts = entries
    .map((e) => `${e.id}:${e.updatedAt ?? e.createdAt ?? 0}`)
    .sort()
    .join('|')
  let hash = 0
  for (let i = 0; i < parts.length; i++) {
    hash = (hash * 31 + parts.charCodeAt(i)) >>> 0
  }
  return `${entries.length}:${hash.toString(16)}`
}

export function toSearchSnapshot(entry: EntryRow): ProjectorSearchEntry {
  return {
    id: entry.id,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    dateKey: entry.dateKey,
    sentiment: entry.sentiment,
    emotion: entry.emotion,
    emotionNote: entry.emotionNote,
    situation: entry.situation,
    details: entry.details,
    behavioursNoted: entry.behavioursNoted ?? '',
    reoccurringTheme: entry.reoccurringTheme ?? '',
    flaggedTerms: entry.flaggedTerms,
    warningLevel: entry.warningLevel,
    riskScore: entry.riskScore,
    interventionScore: entry.interventionScore,
    riskLevel: entry.riskLevel,
    scoreDelta: entry.scoreDelta,
    streakAtSubmit: entry.streakAtSubmit,
  }
}

export async function loadAllEntriesForSearch(): Promise<ProjectorSearchEntry[]> {
  const rows = await getDb().entries.toArray()
  return rows.map(toSearchSnapshot)
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
  if (getSkipSearchRateLimit()) return { ok: true as const }
  const state = readRateState()
  const hourAgo = now - 60 * 60 * 1000
  const dayAgo = now - 24 * 60 * 60 * 1000
  const recent = state.timestamps.filter((ts) => ts >= dayAgo)
  const hourCount = recent.filter((ts) => ts >= hourAgo).length
  const dayCount = recent.length

  if (hourCount >= HOUR_LIMIT) {
    return { ok: false as const, reason: `Hourly search limit reached (${HOUR_LIMIT}/hour).` }
  }
  if (dayCount >= DAY_LIMIT) {
    return { ok: false as const, reason: `Daily search limit reached (${DAY_LIMIT}/day).` }
  }

  recent.push(now)
  writeRateState({ timestamps: recent })
  return { ok: true as const }
}

export async function requestProjectorSearch(options: {
  query: string
  mode?: ProjectorSearchMode
  messages?: ProjectorSearchMessage[]
  userId?: string
  entries?: ProjectorSearchEntry[]
  forceIndex?: boolean
  skipRateLimit?: boolean
}): Promise<ProjectorSearchResult> {
  if (!projectorSearchEnabled() && !options.forceIndex) {
    throw new Error('Projector AI search is disabled.')
  }

  const entries = options.entries ?? (await loadAllEntriesForSearch())
  const indexDigest = buildIndexDigest(entries)
  const userId = options.userId || getOrCreateAnonSearchUserId()

  if (options.mode !== 'index' && !options.skipRateLimit) {
    const allowance = consumeRateAllowance(Date.now())
    if (!allowance.ok) {
      return { type: 'error', message: allowance.reason }
    }
  }

  const settings = loadAppSettings()

  if (settings.aiProvider === 'custom') {
    if (options.mode === 'index') {
      return { type: 'entries', entryIds: [], entries: [], indexStatus: 'idle' }
    }

    if (options.mode === 'chat' || options.mode === 'search') {
      try {
        const wantsAnalytical = options.mode === 'search' || /analyze|summary|count/i.test(options.query)
        const matched = localMatchEntries(entries, options.query)

        if (wantsAnalytical && matched.length > 0) {
          const preamble = await customProjectorSearchAnalytical(options.query, matched)
          return {
            type: 'entries',
            entryIds: matched.map(e => e.id),
            entries: matched,
            preamble,
            indexStatus: 'skipped'
          }
        }

        const contextEntries = matched.length > 0 ? matched : entries.slice(0, 40)
        const answer = await customProjectorSearchChat(options.query, options.messages, contextEntries, options.mode === 'chat')

        return {
          type: 'answer',
          text: answer,
          indexStatus: 'skipped'
        }
      } catch (err) {
        return {
          type: 'error',
          message: err instanceof Error ? err.message : 'EX201: Custom AI search failed.',
          indexStatus: 'skipped'
        }
      }
    }
  }

  const endpoint = getProjectorSearchEndpoint()
  const token =
    normalizeEnvToken(import.meta.env.VITE_PROJECTOR_SEARCH_TOKEN) ||
    normalizeEnvToken(import.meta.env.VITE_WEEKLY_AI_TOKEN)

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      query: options.query,
      mode: options.mode ?? 'search',
      messages: options.messages,
      userId,
      indexDigest,
      entries,
      forceIndex: options.forceIndex,
    }),
  })

  if (!response.ok) {
    let detail = ''
    try {
      const errBody = (await response.json()) as { message?: string; error?: string }
      detail = errBody.message || errBody.error || ''
    } catch {
      /* ignore parse errors */
    }
    return {
      type: 'error',
      message: detail || `Search endpoint error (${response.status}).`,
    }
  }

  const body = (await response.json()) as ProjectorSearchResult
  if (body.type === 'entries' || body.type === 'answer' || body.type === 'error') {
    return body
  }
  return { type: 'error', message: 'Unexpected search response.' }
}

export async function probeProjectorSearchEndpoint(): Promise<string> {
  const endpoint = getProjectorSearchEndpoint()
  if (!endpoint) return 'No VITE_PROJECTOR_SEARCH_ENDPOINT configured.'
  try {
    const res = await fetch(endpoint, { method: 'GET' })
    const text = await res.text()
    return `${res.status}: ${text.slice(0, 200)}`
  } catch (error) {
    return error instanceof Error ? error.message : 'Probe failed'
  }
}

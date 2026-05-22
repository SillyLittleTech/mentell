import type { EntryRow } from '../../db/schema'
import { getSkipAiCache, isDebugMode } from '../../shared/debug/debugFlags'
import { scopedStorageKey } from '../../shared/storage/storageScope'
import type { AiProfile } from './aiProfile'
import { profileFingerprint } from './aiProfile'
import type { AiSummaryMode } from './weeklyAiSummary'

const CACHE_KEY = scopedStorageKey('mentell.ai.weekly.cache')

export type WeeklyAiCacheEntry = {
  weekKey: string
  mode: AiSummaryMode
  entriesFingerprint: string
  profileFingerprint: string
  summary: string
  generatedAt: number
}

function readAll(): WeeklyAiCacheEntry[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (row): row is WeeklyAiCacheEntry =>
        row &&
        typeof row === 'object' &&
        typeof (row as WeeklyAiCacheEntry).weekKey === 'string' &&
        typeof (row as WeeklyAiCacheEntry).mode === 'string' &&
        typeof (row as WeeklyAiCacheEntry).entriesFingerprint === 'string' &&
        typeof (row as WeeklyAiCacheEntry).profileFingerprint === 'string' &&
        typeof (row as WeeklyAiCacheEntry).summary === 'string' &&
        typeof (row as WeeklyAiCacheEntry).generatedAt === 'number',
    )
  } catch {
    return []
  }
}

function writeAll(entries: WeeklyAiCacheEntry[]) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(entries))
}

export function entriesFingerprint(entries: EntryRow[]) {
  const stable = [...entries]
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.createdAt - b.createdAt)
    .map((e) => ({
      id: e.id,
      createdAt: e.createdAt,
      sentiment: e.sentiment,
      situation: e.situation,
      details: e.details,
      emotion: e.emotionNote || e.emotion,
    }))
  return JSON.stringify(stable)
}

export function getCachedWeeklySummary(input: {
  weekKey: string
  mode: AiSummaryMode
  entries: EntryRow[]
  profile: AiProfile
}): string | null {
  if (isDebugMode() && getSkipAiCache()) return null

  const fp = entriesFingerprint(input.entries)
  const pfp = profileFingerprint(input.profile)
  const hit = readAll().find(
    (e) =>
      e.weekKey === input.weekKey &&
      e.mode === input.mode &&
      e.entriesFingerprint === fp &&
      e.profileFingerprint === pfp,
  )
  return hit?.summary ?? null
}

export function setCachedWeeklySummary(input: {
  weekKey: string
  mode: AiSummaryMode
  entries: EntryRow[]
  profile: AiProfile
  summary: string
}) {
  const fp = entriesFingerprint(input.entries)
  const pfp = profileFingerprint(input.profile)
  const next: WeeklyAiCacheEntry = {
    weekKey: input.weekKey,
    mode: input.mode,
    entriesFingerprint: fp,
    profileFingerprint: pfp,
    summary: input.summary,
    generatedAt: Date.now(),
  }

  const rest = readAll().filter(
    (e) => !(e.weekKey === input.weekKey && e.mode === input.mode),
  )
  writeAll([...rest, next])
}

export function clearWeeklyAiCache() {
  localStorage.removeItem(CACHE_KEY)
}

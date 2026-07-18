import type { Env } from './env'
import type { EntrySnapshot } from './entryMerge'

export type AiSearchInstance = {
  search: (opts: Record<string, unknown>) => Promise<{
    chunks?: Array<{
      score?: number
      text?: string
      item?: { key?: string; metadata?: Record<string, unknown> }
    }>
  }>
  chatCompletions: (opts: Record<string, unknown>) => Promise<{
    choices?: Array<{ message?: { content?: string } }>
    chunks?: Array<{
      score?: number
      text?: string
      item?: { key?: string; metadata?: Record<string, unknown> }
    }>
  }>
  items: {
    upload: (
      name: string,
      content: string,
      options?: { metadata?: Record<string, string> },
    ) => Promise<{ id: string; key: string }>
    uploadAndPoll: (
      name: string,
      content: string,
      options?: {
        metadata?: Record<string, string>
        pollIntervalMs?: number
        timeoutMs?: number
      },
    ) => Promise<{ id: string; key: string; status?: string }>
  }
}

/**
 * Soft cap under Cloudflare AI Search's 4 MB hard file limit.
 * Packs stay below this so uploads are not rejected as over_size.
 */
export const AI_SEARCH_MAX_FILE_BYTES = Math.floor(3.5 * 1024 * 1024)

const ENTRY_START_MARKER = '<!-- mentell-entry:start'
const ENTRY_END_MARKER = '<!-- mentell-entry:end'

export function getAiSearchInstance(env: Env): AiSearchInstance | null {
  const binding = env.AI_SEARCH
  if (!binding) return null
  return binding as unknown as AiSearchInstance
}

export function entryItemKey(userId: string, entryId: string) {
  return `journals/${userId}/${entryId}.md`
}

/** Packed multi-entry document key (0-based pack index). */
export function packItemKey(userId: string, packIndex: number) {
  return `journals/${userId}/pack-${packIndex}.md`
}

/** Built-in AI Search folder attribute for a tenant's journal docs. */
export function userFolder(userId: string) {
  return `journals/${userId}/`
}

/** Retrieval filters scoped to a single userId (custom metadata + folder path). */
export function buildRetrievalFilters(userId: string) {
  return {
    userId,
    folder: userFolder(userId),
  }
}

export type AiSearchChunk = {
  score?: number
  text?: string
  item?: { key?: string; metadata?: Record<string, unknown> }
}

export function chunkBelongsToUser(chunk: AiSearchChunk, userId: string) {
  const key = chunk.item?.key
  if (typeof key === 'string' && key.startsWith(userFolder(userId))) return true
  const metaUserId = chunk.item?.metadata?.userId
  if (typeof metaUserId === 'string' && metaUserId === userId) return true
  return false
}

export function filterChunksForUser(chunks: AiSearchChunk[] | undefined, userId: string) {
  if (!chunks?.length) return [] as AiSearchChunk[]
  return chunks.filter((chunk) => chunkBelongsToUser(chunk, userId))
}

/** Shared ai_search_options: tenant filters + similarity cache off. */
export function tenantAiSearchOptions(
  userId: string,
  retrieval: Record<string, unknown>,
) {
  return {
    retrieval: {
      ...retrieval,
      filters: buildRetrievalFilters(userId),
    },
    cache: { enabled: false },
  }
}

export function utf8ByteLength(text: string) {
  return new TextEncoder().encode(text).length
}

/** Single-entry markdown body (without pack markers). */
export function formatEntryDocument(entry: EntrySnapshot) {
  return [
    `# Journal entry ${entry.dateKey}`,
    '',
    `- entryId: ${entry.id}`,
    `- dateKey: ${entry.dateKey}`,
    `- sentiment: ${entry.sentiment}`,
    `- emotion: ${entry.emotionNote || entry.emotion || ''}`,
    '',
    '## Situation',
    entry.situation || '—',
    '',
    '## Details',
    entry.details || '—',
    '',
    '## Behaviours noted',
    entry.behavioursNoted || '—',
    '',
    '## Reoccurring theme',
    entry.reoccurringTheme || '—',
    '',
  ].join('\n')
}

/** Wrap an entry with clear MD/HTML markers so packed files stay parseable. */
export function formatMarkedEntryDocument(entry: EntrySnapshot) {
  const body = formatEntryDocument(entry)
  return [
    `${ENTRY_START_MARKER} entryId="${entry.id}" dateKey="${entry.dateKey}" -->`,
    '',
    body.trimEnd(),
    '',
    `${ENTRY_END_MARKER} entryId="${entry.id}" -->`,
    '',
  ].join('\n')
}

export type IndexPack = {
  packIndex: number
  entries: EntrySnapshot[]
  content: string
  byteLength: number
}

/**
 * Group entries into as few files as possible under {@link AI_SEARCH_MAX_FILE_BYTES}.
 * Before appending an entry, checks whether it would push the current pack over the
 * limit; if so, starts a new pack. A single oversized entry becomes its own pack.
 */
export function packEntriesForAiSearch(
  entries: EntrySnapshot[],
  maxBytes = AI_SEARCH_MAX_FILE_BYTES,
): IndexPack[] {
  const packs: IndexPack[] = []
  let currentEntries: EntrySnapshot[] = []
  let currentParts: string[] = []
  let currentBytes = 0

  const flush = () => {
    if (currentEntries.length === 0) return
    const content = currentParts.join('\n')
    packs.push({
      packIndex: packs.length,
      entries: currentEntries,
      content,
      byteLength: utf8ByteLength(content),
    })
    currentEntries = []
    currentParts = []
    currentBytes = 0
  }

  for (const entry of entries) {
    const marked = formatMarkedEntryDocument(entry)
    const markedBytes = utf8ByteLength(marked)
    const separator = currentParts.length > 0 ? '\n' : ''
    const separatorBytes = separator ? utf8ByteLength(separator) : 0
    const nextBytes = currentBytes + separatorBytes + markedBytes

    if (currentParts.length > 0 && nextBytes > maxBytes) {
      flush()
      currentEntries = [entry]
      currentParts = [marked]
      currentBytes = markedBytes
      continue
    }

    if (separator) currentParts.push(separator)
    currentParts.push(marked)
    currentEntries.push(entry)
    currentBytes = nextBytes
  }

  flush()
  return packs
}

function packMetadata(userId: string, pack: IndexPack) {
  const first = pack.entries[0]
  const latestUpdated = pack.entries.reduce(
    (max, e) => Math.max(max, e.updatedAt ?? e.createdAt ?? 0),
    0,
  )
  // Custom metadata text values are capped at 500 chars — store the first id and
  // rely on MD markers + chunk text for the full entryId set.
  return {
    userId,
    entryId: first?.id ?? `pack-${pack.packIndex}`,
    dateKey: first?.dateKey ?? '',
    updatedAt: String(latestUpdated),
  }
}

/**
 * Upsert journal entries into AI Search when the client digest changed.
 * Packs multiple entries into files under the soft size limit with clear MD markers.
 * Uses non-blocking upload only — uploadAndPoll over the remote wrangler
 * binding frequently hits WebSocket 1006 / ~30s timeouts and must not block search.
 */
export async function syncEntriesToAiSearch(
  instance: AiSearchInstance,
  userId: string,
  entries: EntrySnapshot[],
) {
  if (entries.length === 0) return

  const packs = packEntriesForAiSearch(entries)
  const results = await Promise.allSettled(
    packs.map(async (pack) => {
      const key = packItemKey(userId, pack.packIndex)
      await instance.items.upload(key, pack.content, {
        metadata: packMetadata(userId, pack),
      })
    }),
  )
  const failed = results.filter((r) => r.status === 'rejected').length
  const ok = results.length - failed
  if (ok === 0 && failed > 0) {
    const first = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
    const msg = first.reason instanceof Error ? first.reason.message : String(first.reason)
    throw new Error(`AI Search index upload failed for all ${failed} packs: ${msg}`)
  }
}

const ENTRY_ID_FROM_TEXT_RE =
  /(?:entryId\s*[:=]\s*["']?([A-Za-z0-9_-]+)|mentell-entry:start\s+entryId="([A-Za-z0-9_-]+)")/gi

function collectEntryIdsFromText(text: string | undefined, seen: Set<string>, ids: string[]) {
  if (!text) return
  ENTRY_ID_FROM_TEXT_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = ENTRY_ID_FROM_TEXT_RE.exec(text)) !== null) {
    const entryId = match[1] || match[2]
    if (entryId && !entryId.startsWith('pack-') && !seen.has(entryId)) {
      seen.add(entryId)
      ids.push(entryId)
    }
  }
}

export function extractEntryIdsFromChunks(
  chunks:
    | Array<{
        score?: number
        text?: string
        item?: { metadata?: Record<string, unknown>; key?: string }
      }>
    | undefined,
  minScore = 0.35,
): string[] {
  if (!chunks?.length) return []
  const ids: string[] = []
  const seen = new Set<string>()
  for (const chunk of chunks) {
    if (typeof chunk.score === 'number' && chunk.score < minScore) continue

    // Prefer IDs embedded in chunk text (covers packed multi-entry files).
    collectEntryIdsFromText(chunk.text, seen, ids)

    const meta = chunk.item?.metadata
    let entryId =
      typeof meta?.entryId === 'string'
        ? meta.entryId
        : typeof meta?.entryId === 'number'
          ? String(meta.entryId)
          : typeof meta?.entryid === 'string'
            ? (meta.entryid as string)
            : ''
    // Ignore pack-* metadata placeholders; real ids come from markers/text.
    if (entryId.startsWith('pack-')) entryId = ''
    if (!entryId && chunk.item?.key) {
      const m = chunk.item.key.match(/\/([^/]+)\.md$/)
      const keyName = m?.[1] ?? ''
      // Legacy per-entry keys: journals/{userId}/{entryId}.md — not pack-N.md
      if (keyName && !keyName.startsWith('pack-')) entryId = keyName
    }
    if (entryId && !seen.has(entryId)) {
      seen.add(entryId)
      ids.push(entryId)
    }
  }
  return ids
}

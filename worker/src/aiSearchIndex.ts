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

export function getAiSearchInstance(env: Env): AiSearchInstance | null {
  const binding = env.AI_SEARCH
  if (!binding) return null
  return binding as unknown as AiSearchInstance
}

export function entryItemKey(userId: string, entryId: string) {
  return `journals/${userId}/${entryId}.md`
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
  ].join('\n')
}

/**
 * Upsert journal entries into AI Search when the client digest changed.
 * Uses non-blocking upload only — uploadAndPoll over the remote wrangler
 * binding frequently hits WebSocket 1006 / ~30s timeouts and must not block search.
 */
export async function syncEntriesToAiSearch(
  instance: AiSearchInstance,
  userId: string,
  entries: EntrySnapshot[],
  _options?: { waitForFirst?: number },
) {
  const results = await Promise.allSettled(
    entries.map(async (entry) => {
      const key = entryItemKey(userId, entry.id)
      const content = formatEntryDocument(entry)
      const metadata = {
        userId,
        entryId: entry.id,
        dateKey: entry.dateKey,
        updatedAt: String(entry.updatedAt ?? entry.createdAt ?? 0),
      }
      await instance.items.upload(key, content, { metadata })
    }),
  )
  const failed = results.filter((r) => r.status === 'rejected').length
  const ok = results.length - failed
  if (ok === 0 && failed > 0) {
    const first = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
    const msg = first.reason instanceof Error ? first.reason.message : String(first.reason)
    throw new Error(`AI Search index upload failed for all ${failed} entries: ${msg}`)
  }
}

export function extractEntryIdsFromChunks(
  chunks: Array<{ score?: number; item?: { metadata?: Record<string, unknown>; key?: string } }> | undefined,
  minScore = 0.35,
): string[] {
  if (!chunks?.length) return []
  const ids: string[] = []
  const seen = new Set<string>()
  for (const chunk of chunks) {
    if (typeof chunk.score === 'number' && chunk.score < minScore) continue
    const meta = chunk.item?.metadata
    let entryId =
      typeof meta?.entryId === 'string'
        ? meta.entryId
        : typeof meta?.entryId === 'number'
          ? String(meta.entryId)
          : typeof meta?.entryid === 'string'
            ? (meta.entryid as string)
            : ''
    if (!entryId && chunk.item?.key) {
      const m = chunk.item.key.match(/\/([^/]+)\.md$/)
      if (m) entryId = m[1]
    }
    if (entryId && !seen.has(entryId)) {
      seen.add(entryId)
      ids.push(entryId)
    }
  }
  return ids
}

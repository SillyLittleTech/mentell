import { corsJson, corsResponse } from './cors'
import type { Env } from './env'
import { extractAiText, runWorkersAi } from './aiGateway'
import {
  extractEntryIdsFromChunks,
  filterChunksForUser,
  getAiSearchInstance,
  syncEntriesToAiSearch,
  tenantAiSearchOptions,
  type AiSearchChunk,
} from './aiSearchIndex'
import { fetchEntriesByIds } from './dataFetcher'
import type { EntrySnapshot } from './entryMerge'
import { localMatchEntries, mergeEntrySnapshots } from './localMatch'

type ChatMessage = { role: string; content: string }

type RequestBody = {
  query?: string
  mode?: 'search' | 'chat' | 'index'
  messages?: ChatMessage[]
  userId?: string
  indexDigest?: string
  entries?: EntrySnapshot[]
  forceIndex?: boolean
}

type IndexStatus = 'synced' | 'skipped' | 'failed' | 'idle'

const HOUR_LIMIT = 12
const DAY_LIMIT = 40
const MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct'
const DIGEST_KV_PREFIX = 'ps:digest:'

const ANALYTICAL_RE =
  /\b(how many|how often|count|trend|average|when did|summary of|over time|statistics|stats|compare)\b/i

export async function handleProjectorSearch(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin')

  if (request.method === 'OPTIONS') {
    return corsResponse(null, 204, env, origin)
  }

  if (request.method === 'GET') {
    return corsJson(
      {
        ok: true,
        service: 'projector-search',
        aiSearch: Boolean(env.AI_SEARCH),
      },
      200,
      env,
      origin,
    )
  }

  if (request.method !== 'POST') {
    return corsJson({ error: 'Method not allowed' }, 405, env, origin)
  }

  if (!authorize(request, env)) {
    return corsJson({ error: 'Unauthorized' }, 401, env, origin)
  }

  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return corsJson({ error: 'Invalid JSON body' }, 400, env, origin)
  }

  const mode = body.mode === 'chat' ? 'chat' : body.mode === 'index' ? 'index' : 'search'
  const userId = sanitizeUserId(body.userId)
  if (!userId) {
    return corsJson({ error: 'userId is required' }, 400, env, origin)
  }
  const entries = Array.isArray(body.entries) ? body.entries.filter((e) => e && typeof e.id === 'string') : []
  const query = typeof body.query === 'string' ? body.query.trim() : ''

  const ip = clientIp(request)
  if (mode !== 'index') {
    const limited = await enforceRateLimit(env, ip)
    if (!limited.ok) {
      return corsJson({ type: 'error', message: limited.reason }, 429, env, origin)
    }
  }

  const instance = getAiSearchInstance(env)

  let indexStatus: IndexStatus = 'idle'
  try {
    if (instance && (body.forceIndex || body.indexDigest)) {
      indexStatus = await maybeSyncIndex(
        env,
        instance,
        userId,
        entries,
        body.indexDigest,
        Boolean(body.forceIndex),
      )
    }

    if (mode === 'index') {
      return corsJson(
        {
          type: 'answer',
          text: `Indexed ${entries.length} entries for ${userId}.`,
          indexStatus,
        },
        200,
        env,
        origin,
      )
    }

    if (!query && mode === 'search') {
      return corsJson({ type: 'error', message: 'query is required', indexStatus }, 400, env, origin)
    }

    const localHits = localMatchEntries(entries, query)

    if (!instance) {
      return handleLocalFallback(env, {
        query,
        mode,
        messages: body.messages,
        userId,
        entries,
        origin,
        indexStatus,
        localHits,
      })
    }

    try {
      if (mode === 'chat') {
        return await handleVerifiedSearchAnswer(env, {
          instance,
          query,
          userId,
          entries,
          localHits,
          indexStatus,
          origin,
          messages: body.messages,
          maxResults: 8,
          matchThreshold: 0.35,
          preferChat: true,
        })
      }

      // Search mode
      const search = await instance.search({
        messages: [{ role: 'user', content: query }],
        ai_search_options: tenantAiSearchOptions(userId, {
          max_num_results: 10,
          match_threshold: 0.35,
          retrieval_type: 'hybrid',
        }),
      })

      const ownedChunks = filterChunksForUser(search.chunks, userId)
      const fromChunks = await resolveFromChunkIds(
        env,
        extractEntryIdsFromChunks(ownedChunks),
        entries,
        userId,
      )
      const merged = mergeEntrySnapshots(fromChunks, localHits)

      const wantsAnalytical = ANALYTICAL_RE.test(query)

      // Prefer pretty entry cards whenever we have matches (including sentiment queries)
      if (merged.length > 0 && !wantsAnalytical) {
        let preamble: string | undefined
        try {
          const brief = await runWorkersAi(env, MODEL, {
            messages: [
              {
                role: 'system',
                content:
                  'You write one short sentence introducing matching journal entries. Mention dates and situations briefly. Never invent entry ids. No diagnosis or medical advice.',
              },
              {
                role: 'user',
                content: `Query: ${query}\nMatched entries:\n${merged
                  .map(
                    (e) =>
                      `${e.dateKey} [${e.sentiment}] ${e.situation}: ${(e.details || '').slice(0, 120)}`,
                  )
                  .join('\n')}`,
              },
            ],
          })
          preamble = extractAiText(brief).trim() || undefined
        } catch {
          preamble = undefined
        }
        return corsJson(
          {
            type: 'entries',
            entryIds: merged.map((e) => e.id),
            entries: merged,
            preamble,
            indexStatus,
          },
          200,
          env,
          origin,
        )
      }

      // Analytical with known matches → cards + contextual preamble
      if (merged.length > 0 && wantsAnalytical) {
        let preamble: string | undefined
        try {
          const brief = await runWorkersAi(env, MODEL, {
            messages: [
              {
                role: 'system',
                content: chatSystemPrompt(),
              },
              {
                role: 'user',
                content: `Question: ${query}\n\nMatching journal entries (use situation/details, never raw ids):\n${merged
                  .map(
                    (e) =>
                      `${e.dateKey} sentiment=${e.sentiment} situation=${e.situation} details=${(e.details || '').slice(0, 200)}`,
                  )
                  .join('\n')}`,
              },
            ],
          })
          preamble = extractAiText(brief).trim() || undefined
        } catch {
          preamble = `${merged.length} matching entr${merged.length === 1 ? 'y' : 'ies'} found.`
        }
        return corsJson(
          {
            type: 'entries',
            entryIds: merged.map((e) => e.id),
            entries: merged,
            preamble,
            indexStatus,
          },
          200,
          env,
          origin,
        )
      }

      // No entry cards → plain-text answer from owned retrieval only (never unscoped chatCompletions)
      return await handleVerifiedSearchAnswer(env, {
        instance,
        query,
        userId,
        entries,
        localHits,
        indexStatus,
        origin,
        ownedChunks,
        maxResults: 10,
        matchThreshold: 0.35,
        preferChat: false,
      })
    } catch (searchErr) {
      const msg = searchErr instanceof Error ? searchErr.message : String(searchErr)
      console.warn('[projector-search] AI Search query failed, local fallback', msg)
      return handleLocalFallback(env, {
        query,
        mode: mode === 'chat' ? 'chat' : 'search',
        messages: body.messages,
        userId,
        entries,
        origin,
        indexStatus: indexStatus === 'idle' ? 'failed' : indexStatus,
        localHits,
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Projector search failed'
    const stack = error instanceof Error ? error.stack?.slice(0, 500) : undefined
    console.error('[projector-search]', message, stack)
    try {
      return await handleLocalFallback(env, {
        query,
        mode: mode === 'chat' ? 'chat' : 'search',
        messages: body.messages,
        userId,
        entries,
        origin,
        indexStatus: 'failed',
        localHits: localMatchEntries(entries, query),
      })
    } catch {
      return corsJson({ type: 'error', message, indexStatus: 'failed' }, 500, env, origin)
    }
  }
}

/**
 * Search with tenant filters, keep only owned chunks, then answer via Workers AI
 * using verified context only (never trust AI Search chatCompletions RAG text).
 */
async function handleVerifiedSearchAnswer(
  env: Env,
  opts: {
    instance: NonNullable<ReturnType<typeof getAiSearchInstance>>
    query: string
    userId: string
    entries: EntrySnapshot[]
    localHits: EntrySnapshot[]
    indexStatus: IndexStatus
    origin: string | null
    messages?: ChatMessage[]
    ownedChunks?: AiSearchChunk[]
    maxResults: number
    matchThreshold: number
    preferChat: boolean
  },
) {
  let ownedChunks = opts.ownedChunks
  if (!ownedChunks) {
    const search = await opts.instance.search({
      messages: [{ role: 'user', content: opts.query }],
      ai_search_options: tenantAiSearchOptions(opts.userId, {
        max_num_results: opts.maxResults,
        match_threshold: opts.matchThreshold,
        retrieval_type: 'hybrid',
      }),
    })
    ownedChunks = filterChunksForUser(search.chunks, opts.userId)
  }

  const fromChunks = await resolveFromChunkIds(
    env,
    extractEntryIdsFromChunks(ownedChunks, opts.matchThreshold),
    opts.entries,
    opts.userId,
  )
  const merged = mergeEntrySnapshots(fromChunks, opts.localHits)

  const contextBlocks: string[] = []
  for (const chunk of ownedChunks) {
    if (typeof chunk.text === 'string' && chunk.text.trim()) {
      contextBlocks.push(chunk.text.trim().slice(0, 800))
    }
  }
  for (const e of opts.localHits) {
    contextBlocks.push(
      `${e.dateKey} [${e.sentiment}] ${e.situation}: ${(e.details || '').slice(0, 200)}`,
    )
  }

  let text = ''
  if (contextBlocks.length > 0 || opts.preferChat) {
    try {
      const messages = opts.preferChat
        ? [
            { role: 'system', content: chatSystemPrompt() },
            ...normalizeMessages(opts.messages, opts.query),
            ...(contextBlocks.length
              ? [
                  {
                    role: 'system' as const,
                    content: `Owned journal context for this user only:\n${contextBlocks.slice(0, 12).join('\n---\n')}`,
                  },
                ]
              : []),
          ]
        : [
            { role: 'system', content: chatSystemPrompt() },
            {
              role: 'user',
              content: `Question: ${opts.query}\n\nJournal context (this user only):\n${
                contextBlocks.slice(0, 12).join('\n---\n') || '(none)'
              }`,
            },
          ]
      const brief = await runWorkersAi(env, MODEL, { messages })
      text = extractAiText(brief).trim()
    } catch {
      text = ''
    }
  }

  if (merged.length > 0) {
    return corsJson(
      {
        type: 'entries',
        entryIds: merged.map((e) => e.id),
        entries: merged,
        preamble: text || undefined,
        indexStatus: opts.indexStatus,
      },
      200,
      env,
      opts.origin,
    )
  }

  return corsJson(
    {
      type: 'answer',
      text:
        text ||
        (contextBlocks.length === 0
          ? 'No matching journal context found for that question.'
          : 'I could not find enough context to answer that.'),
      indexStatus: opts.indexStatus,
    },
    200,
    env,
    opts.origin,
  )
}

function isAnonymousSearchUserId(userId: string) {
  return userId === 'anon' || userId === 'anon_local' || userId.startsWith('anon_')
}

async function resolveFromChunkIds(
  env: Env,
  entryIds: string[],
  entries: EntrySnapshot[],
  userId: string,
) {
  if (entryIds.length === 0) return [] as EntrySnapshot[]
  return fetchEntriesByIds({
    entryIds,
    localEntries: entries,
    userId: isAnonymousSearchUserId(userId) ? undefined : userId,
    serviceAccountJson: env.FIREBASE_SERVICE_ACCOUNT_JSON,
  })
}

async function handleLocalFallback(
  env: Env,
  opts: {
    query: string
    mode: 'search' | 'chat'
    messages?: ChatMessage[]
    userId: string
    entries: EntrySnapshot[]
    origin: string | null
    indexStatus?: IndexStatus
    localHits?: EntrySnapshot[]
  },
) {
  const matched =
    opts.localHits && opts.localHits.length > 0
      ? opts.localHits
      : localMatchEntries(opts.entries, opts.query)

  if (matched.length > 0) {
    let preamble: string | undefined
    if (ANALYTICAL_RE.test(opts.query) || opts.mode === 'chat') {
      try {
        const brief = await runWorkersAi(env, MODEL, {
          messages: [
            { role: 'system', content: chatSystemPrompt() },
            {
              role: 'user',
              content: `Question: ${opts.query}\n\nMatching journal entries (use situation/details, never raw ids):\n${matched
                .map(
                  (e) =>
                    `${e.dateKey} sentiment=${e.sentiment} situation=${e.situation} details=${(e.details || '').slice(0, 200)}`,
                )
                .join('\n')}`,
            },
          ],
        })
        preamble = extractAiText(brief).trim() || undefined
      } catch {
        preamble = undefined
      }
    }
    return corsJson(
      {
        type: 'entries',
        entryIds: matched.map((e) => e.id),
        entries: matched,
        preamble:
          preamble ||
          (opts.indexStatus === 'failed'
            ? 'Local match (cloud search unavailable).'
            : undefined),
        indexStatus: opts.indexStatus ?? 'idle',
      },
      200,
      env,
      opts.origin,
    )
  }

  const context = opts.entries
    .slice(0, 40)
    .map(
      (e) =>
        `${e.dateKey} [${e.sentiment}] ${e.situation}: ${(e.details || '').slice(0, 200)}`,
    )
    .join('\n')

  const messages =
    opts.mode === 'chat'
      ? [
          { role: 'system', content: chatSystemPrompt() },
          ...normalizeMessages(opts.messages, opts.query),
        ]
      : [
          { role: 'system', content: chatSystemPrompt() },
          {
            role: 'user',
            content: `Journal context:\n${context || '(none)'}\n\nQuestion: ${opts.query}`,
          },
        ]

  try {
    const result = await runWorkersAi(env, MODEL, { messages })
    const text = extractAiText(result).trim()
    return corsJson(
      {
        type: 'answer',
        text: text || 'Could not generate an answer.',
        indexStatus: opts.indexStatus ?? 'idle',
      },
      200,
      env,
      opts.origin,
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[projector-search] local fallback AI unavailable', msg)
    return corsJson(
      {
        type: 'answer',
        text: 'No matching journal context found for that question.',
        indexStatus: opts.indexStatus ?? 'failed',
      },
      200,
      env,
      opts.origin,
    )
  }
}

async function maybeSyncIndex(
  env: Env,
  instance: NonNullable<ReturnType<typeof getAiSearchInstance>>,
  userId: string,
  entries: EntrySnapshot[],
  indexDigest: string | undefined,
  force: boolean,
): Promise<IndexStatus> {
  if (entries.length === 0) return 'idle'
  const digestKey = `${DIGEST_KV_PREFIX}${userId}`
  const prev = await env.RATE_LIMIT_KV.get(digestKey)
  const skipped = !force && Boolean(indexDigest) && prev === indexDigest
  if (skipped) return 'skipped'
  try {
    await syncEntriesToAiSearch(instance, userId, entries, { waitForFirst: 0 })
    if (indexDigest) {
      await env.RATE_LIMIT_KV.put(digestKey, indexDigest, { expirationTtl: 60 * 60 * 24 * 30 })
    }
    return 'synced'
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[projector-search] index sync failed, continuing', msg)
    return 'failed'
  }
}

function chatSystemPrompt() {
  return `You help the user explore their personal mental-health journal.
Do not diagnose, prescribe, or give medical advice.
If entries mention crisis language, gently encourage trusted support or local emergency services.
Answer from retrieved journal context only. If context is missing, say so plainly.
When referring to entries, use date and situation (and a short details snippet). Never print raw entry ids.
For data questions (counts, trends, timing), reply in plain language with that context.`
}

function normalizeMessages(messages: ChatMessage[] | undefined, query: string): ChatMessage[] {
  if (Array.isArray(messages) && messages.length > 0) {
    return messages
      .filter((m) => m && typeof m.content === 'string' && typeof m.role === 'string')
      .map((m) => ({
        role: m.role === 'assistant' || m.role === 'system' ? m.role : 'user',
        content: m.content.slice(0, 4000),
      }))
      .slice(-12)
  }
  return [{ role: 'user', content: query }]
}

function sanitizeUserId(raw: string | undefined) {
  if (!raw || typeof raw !== 'string') return ''
  return raw.trim().slice(0, 128).replace(/[^a-zA-Z0-9_-]/g, '')
}

function authorize(request: Request, env: Env) {
  const header = request.headers.get('Authorization') ?? ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  if (!match) return false
  const token = normalizeToken(match[1])
  const expected = normalizeToken(env.PROJECTOR_SEARCH_TOKEN || env.WEEKLY_SUMMARY_TOKEN)
  return Boolean(expected) && token === expected
}

function normalizeToken(raw: string) {
  const t = raw.trim()
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1)
  }
  return t
}

function clientIp(request: Request) {
  return (
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown'
  )
}

async function enforceRateLimit(env: Env, ip: string) {
  const now = Date.now()
  const hourKey = `ps:h:${ip}:${Math.floor(now / (60 * 60 * 1000))}`
  const dayKey = `ps:d:${ip}:${Math.floor(now / (24 * 60 * 60 * 1000))}`

  const hourCount = await increment(env.RATE_LIMIT_KV, hourKey)
  if (hourCount > HOUR_LIMIT) {
    return { ok: false as const, reason: `Hourly search limit reached (${HOUR_LIMIT}/hour).` }
  }

  const dayCount = await increment(env.RATE_LIMIT_KV, dayKey)
  if (dayCount > DAY_LIMIT) {
    return { ok: false as const, reason: `Daily search limit reached (${DAY_LIMIT}/day).` }
  }

  return { ok: true as const }
}

async function increment(kv: KVNamespace, key: string) {
  const raw = await kv.get(key)
  const next = (raw ? Number(raw) : 0) + 1
  await kv.put(key, String(next), { expirationTtl: 60 * 60 * 48 })
  return next
}

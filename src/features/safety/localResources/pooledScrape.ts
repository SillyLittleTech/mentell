import { isDebugMode } from '../../../shared/debug/debugFlags'
import { isAiEnabledLocally } from '../../../shared/settings/appSettings'
import type { GeoPlace, LocalResource, LocalResourceFetchResult, ResourceTopic } from './types'
import { dedupePooledAgainstExisting, formatPooledSourceLabel } from './dedupeResources'
import {
  diagnosePooledScrapeConfig,
  isPooledScrapeConfigured,
  pooledScrapeConfigHint,
} from './pooledScrapeConfig'
import { resolveWorkerRoute, workerAuthToken } from './workerRoute'

export type PooledScrapeStatus =
  | 'skipped_disabled'
  | 'skipped_not_configured'
  | 'skipped_ai_off'
  | 'error_http'
  | 'error_network'
  | 'empty'
  | 'ok'

export type PooledScrapeMeta = {
  status: PooledScrapeStatus
  detail?: string
}

type WorkerPooledRow = {
  name: string
  descriptor: string
  hours?: string
  phone?: string
  chat?: string
  website?: string
  source: string
}

export function pooledCrisisResourcesEndpoint() {
  return resolveWorkerRoute('/pooled-crisis-resources')
}

export { isPooledScrapeConfigured } from './pooledScrapeConfig'

function mapPooledRow(row: WorkerPooledRow, index: number): LocalResource {
  return {
    id: `pooled-${index}-${row.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`,
    kind: 'pooled',
    name: row.name,
    description: row.descriptor,
    phone: row.phone,
    chatUrl: row.chat,
    website: row.website,
    hours: row.hours,
    sourceLabel: formatPooledSourceLabel(row.source),
  }
}

function helplineResults(results: LocalResourceFetchResult[]) {
  return results.filter((row) => row.topic === 'suicide' || row.topic === 'mental_health')
}

function mergePooledIntoResults(
  results: LocalResourceFetchResult[],
  pooled: LocalResource[],
): LocalResourceFetchResult[] {
  const topic: ResourceTopic = results.some((r) => r.topic === 'suicide') ? 'suicide' : 'mental_health'
  const target = helplineResults(results)[0]
  if (target) {
    return results.map((row) =>
      row === target ? { ...row, resources: [...row.resources, ...pooled] } : row,
    )
  }
  return [...results, { topic, resources: pooled }]
}

export async function appendPooledScrapeResources(
  results: LocalResourceFetchResult[],
  place: GeoPlace,
  topics: ResourceTopic[],
  signal?: AbortSignal,
): Promise<{ results: LocalResourceFetchResult[]; meta: PooledScrapeMeta }> {
  const wantsHelplines = topics.includes('suicide') || topics.includes('mental_health')
  if (!wantsHelplines) {
    return { results, meta: { status: 'skipped_not_configured', detail: 'No helpline topics' } }
  }
  if (!isAiEnabledLocally()) {
    return { results, meta: { status: 'skipped_ai_off' } }
  }
  if (!isPooledScrapeConfigured()) {
    const { issues } = diagnosePooledScrapeConfig()
    return {
      results,
      meta: {
        status: 'skipped_not_configured',
        detail: pooledScrapeConfigHint(issues),
      },
    }
  }

  if (import.meta.env.DEV && import.meta.env.VITE_POOLED_DEV_FIXTURE === '1') {
    const helplineRows = helplineResults(results)
    const existing = helplineRows.flatMap((row) => row.resources)
    const fixture: LocalResource[] = dedupePooledAgainstExisting(
      [
        {
          id: 'pooled-dev-fixture-blair',
          kind: 'pooled',
          name: 'Blair County Mobile Crisis (dev fixture)',
          description: 'Local dev fixture for visual testing of pooled AI suggestions.',
          phone: '814-555-0199',
          hours: '24/7',
          sourceLabel: formatPooledSourceLabel('Worker dev fixture'),
        },
      ],
      existing,
    )
    if (fixture.length) {
      return {
        results: mergePooledIntoResults(results, fixture),
        meta: { status: 'ok', detail: 'dev fixture' },
      }
    }
    return { results, meta: { status: 'empty', detail: 'dev fixture deduped' } }
  }

  const endpoint = pooledCrisisResourcesEndpoint()
  const token = workerAuthToken()
  if (!endpoint || !token) {
    const { issues } = diagnosePooledScrapeConfig()
    return {
      results,
      meta: {
        status: 'skipped_not_configured',
        detail: pooledScrapeConfigHint(issues),
      },
    }
  }

  const helplineRows = helplineResults(results)
  const existing = helplineRows.flatMap((row) => row.resources)

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 22000)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        location: {
          countryCode: place.countryCode,
          regionCode: place.regionCode,
          city: place.city,
          county: place.county,
          zip: place.zip,
        },
        topics: topics.filter((topic) => topic === 'suicide' || topic === 'mental_health'),
        existing: existing.map((resource) => ({
          name: resource.name,
          phone: resource.phone,
        })),
      }),
      signal: controller.signal,
    })
    if (!response.ok) {
      const detail = isDebugMode() ? `${response.status} ${response.statusText}` : undefined
      if (isDebugMode()) {
        console.warn('[pooled-crisis-resources]', detail, await response.text().catch(() => ''))
      }
      return {
        results,
        meta: { status: 'error_http', detail: detail ?? String(response.status) },
      }
    }
    const data = (await response.json()) as { resources?: WorkerPooledRow[]; error?: string }
    const rows = Array.isArray(data.resources) ? data.resources : []
    const pooled = dedupePooledAgainstExisting(
      rows.map((row, index) => mapPooledRow(row, index)),
      existing,
    )
    if (!pooled.length) {
      return {
        results,
        meta: {
          status: 'empty',
          detail: isDebugMode() ? (data.error ?? 'No unique rows after dedupe') : undefined,
        },
      }
    }
    return {
      results: mergePooledIntoResults(results, pooled),
      meta: { status: 'ok', detail: isDebugMode() ? `${pooled.length} suggestion(s)` : undefined },
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    if (isDebugMode()) console.warn('[pooled-crisis-resources]', detail)
    return {
      results,
      meta: { status: 'error_network', detail: isDebugMode() ? detail : undefined },
    }
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', onAbort)
  }
}

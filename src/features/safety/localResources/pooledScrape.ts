import { isAiEnabledLocally } from '../../../shared/settings/appSettings'
import type { GeoPlace, LocalResource, LocalResourceFetchResult, ResourceTopic } from './types'
import { dedupePooledAgainstExisting, formatPooledSourceLabel } from './dedupeResources'

const POOLED_SUFFIX = ' (Pooled Scrape, check important details)'

type WorkerPooledRow = {
  name: string
  descriptor: string
  hours?: string
  phone?: string
  chat?: string
  website?: string
  source: string
}

function normalizeEnvToken(raw: string | undefined) {
  if (!raw) return ''
  const t = raw.trim()
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1)
  }
  return t
}

function normalizeEndpointUrl(endpoint: string) {
  return endpoint.replace(/\/+$/, '')
}

export function pooledCrisisResourcesEndpoint() {
  const weeklyEndpoint = import.meta.env.VITE_WEEKLY_AI_ENDPOINT
  if (typeof weeklyEndpoint !== 'string' || !weeklyEndpoint.trim()) return null
  return normalizeEndpointUrl(weeklyEndpoint).replace(/\/weekly-summary\/?$/, '/pooled-crisis-resources')
}

export function isPooledScrapeConfigured() {
  return (
    import.meta.env.VITE_ENABLE_WEEKLY_AI_SUMMARY === '1' &&
    Boolean(pooledCrisisResourcesEndpoint()) &&
    Boolean(normalizeEnvToken(import.meta.env.VITE_WEEKLY_AI_TOKEN))
  )
}

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

export async function appendPooledScrapeResources(
  results: LocalResourceFetchResult[],
  place: GeoPlace,
  topics: ResourceTopic[],
): Promise<LocalResourceFetchResult[]> {
  const wantsHelplines = topics.includes('suicide') || topics.includes('mental_health')
  if (!wantsHelplines || !isPooledScrapeConfigured() || !isAiEnabledLocally()) {
    return results
  }

  const endpoint = pooledCrisisResourcesEndpoint()
  const token = normalizeEnvToken(import.meta.env.VITE_WEEKLY_AI_TOKEN)
  if (!endpoint || !token) return results

  const helplineRows = helplineResults(results)
  const existing = helplineRows.flatMap((row) => row.resources)

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 18000)
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
    if (!response.ok) return results
    const data = (await response.json()) as { resources?: WorkerPooledRow[] }
    const rows = Array.isArray(data.resources) ? data.resources : []
    const pooled = dedupePooledAgainstExisting(
      rows.map((row, index) => mapPooledRow(row, index)),
      existing,
    )
    if (!pooled.length) return results

    const topic: ResourceTopic = topics.includes('suicide') ? 'suicide' : 'mental_health'
    const target = helplineRows[0]
    if (target) {
      return results.map((row) =>
        row === target ? { ...row, resources: [...row.resources, ...pooled] } : row,
      )
    }
    return [...results, { topic, resources: pooled }]
  } catch {
    return results
  } finally {
    window.clearTimeout(timeout)
  }
}

export { POOLED_SUFFIX }

import type {
  ContactMethodPreference,
  GeoPlace,
  LocalResource,
  LocalResourceFetchResult,
  ResourceTopic,
} from './types'
import { filterByLocalArea } from './geoFilter'
import { coreCrisisResources } from './nationalResources'
import { countyStem, mergeHelplineRows, type HelplineRow } from './rankHelplines'
import {
  helplinesFromApiNotes,
  supplementalHelplinesForPlace,
} from './supplementalHelplines'
import { readHelplineCache, writeHelplineCache } from './helplineQueryCache'

type HelplineContact = {
  phone?: string | null
  sms?: string | null
  chat_url?: string | null
  email?: string | null
}

type HelplineResult = HelplineRow & {
  contact?: HelplineContact
}

function helplineContactMethodParam(pref: ContactMethodPreference) {
  if (pref === 'phone') return 'phone'
  if (pref === 'sms') return 'sms'
  if (pref === 'chat') return 'chat'
  return null
}

function mapHelpline(row: HelplineResult): LocalResource {
  const coverageNote =
    row.coverage && row.coverage !== 'national'
      ? row.coverage.replace(/^regional:/i, 'Regional · ')
      : row.coverage === 'national'
        ? 'Nationwide'
        : undefined
  const description = [coverageNote, row.description].filter(Boolean).join(' — ')
  return {
    id: `gh-${row.id}`,
    kind: 'helpline',
    name: row.name,
    description: description || undefined,
    phone: row.contact?.phone ?? undefined,
    sms: row.contact?.sms ?? undefined,
    chatUrl: row.contact?.chat_url ?? undefined,
    website: row.website,
    hours: row.hours,
    sourceLabel: 'Global Helplines',
  }
}

function helplineKeywords(place: GeoPlace): string[] {
  const keys: string[] = []
  const city = place.city?.trim()
  const county = countyStem(place.county)
  if (city) keys.push(city)
  if (county && county.toLowerCase() !== city?.toLowerCase()) keys.push(county)
  return keys
}

function helplineQueryUrl(
  place: GeoPlace,
  topic: 'suicide' | 'mental_health',
  contactMethod: ContactMethodPreference,
  keyword?: string,
) {
  const country = place.countryCode?.trim().toUpperCase() || 'US'
  const url = new URL('https://globalhelplines.org/v1/helplines')
  url.searchParams.set('country', country)
  url.searchParams.set('topic', topic)
  url.searchParams.set('page_size', '25')
  if (place.regionCode) url.searchParams.set('region', place.regionCode)
  if (keyword) url.searchParams.set('keyword', keyword)
  const method = helplineContactMethodParam(contactMethod)
  if (method) url.searchParams.set('contact_method', method)
  return url.toString()
}

async function queryHelplines(
  place: GeoPlace,
  topic: 'suicide' | 'mental_health',
  contactMethod: ContactMethodPreference,
  keyword?: string,
  signal?: AbortSignal,
): Promise<HelplineResult[]> {
  const url = helplineQueryUrl(place, topic, contactMethod, keyword)
  const cached = readHelplineCache<HelplineResult>(url)
  if (cached) return cached

  try {
    const res = await fetch(url, { signal })
    if (!res.ok) {
      writeHelplineCache(url, [], false)
      return []
    }
    const data = (await res.json()) as { results?: HelplineResult[] }
    const results = data.results ?? []
    writeHelplineCache(url, results, true)
    return results
  } catch (err) {
    if (signal?.aborted) throw err
    writeHelplineCache(url, [], false)
    return []
  }
}

async function runConsolidatedHelplineQueries(
  place: GeoPlace,
  topics: ('suicide' | 'mental_health')[],
  contactMethod: ContactMethodPreference,
  signal?: AbortSignal,
): Promise<HelplineResult[]> {
  const activeTopics: ('suicide' | 'mental_health')[] = topics.length
    ? [...topics]
    : ['mental_health']
  const keywords = helplineKeywords(place)
  const keywordTopic: 'suicide' | 'mental_health' = activeTopics.includes('suicide')
    ? 'suicide'
    : (activeTopics[0] ?? 'mental_health')

  const jobs: Promise<HelplineResult[]>[] = []
  for (const topic of activeTopics) {
    jobs.push(queryHelplines(place, topic, contactMethod, undefined, signal))
  }
  for (const keyword of keywords) {
    jobs.push(queryHelplines(place, keywordTopic, contactMethod, keyword, signal))
  }

  const batches = await Promise.all(jobs)
  return batches.flat()
}

function appendHelplineSupplements(flat: HelplineResult[], place: GeoPlace, resources: LocalResource[]) {
  const hasUpmcAltoonaCrisis = (list: LocalResource[]) =>
    list.some((r) => /upmc altoona crisis/i.test(r.name))
  for (const extra of helplinesFromApiNotes(flat)) {
    if (hasUpmcAltoonaCrisis(resources)) continue
    if (!resources.some((r) => r.id === extra.id)) resources.push(extra)
  }
  for (const extra of supplementalHelplinesForPlace(place)) {
    if (hasUpmcAltoonaCrisis(resources)) continue
    if (!resources.some((r) => r.id === extra.id)) resources.push(extra)
  }
}

async function fetchCombinedHelplines(
  place: GeoPlace,
  includeSuicide: boolean,
  includeMentalHealth: boolean,
  contactMethod: ContactMethodPreference,
  signal?: AbortSignal,
): Promise<LocalResourceFetchResult> {
  const topic: ResourceTopic = includeSuicide ? 'suicide' : 'mental_health'
  const helplineTopics: ('suicide' | 'mental_health')[] = []
  if (includeSuicide) helplineTopics.push('suicide')
  if (includeMentalHealth) helplineTopics.push('mental_health')
  if (!helplineTopics.length) helplineTopics.push('mental_health')

  const flat = await runConsolidatedHelplineQueries(place, helplineTopics, contactMethod, signal)
  const merged = mergeHelplineRows(flat, place, 12)
  const resources = merged.map(mapHelpline)
  appendHelplineSupplements(flat, place, resources)

  for (const core of coreCrisisResources(place.countryCode)) {
    if (!resources.some((r) => r.id === core.id)) {
      resources.push({ ...core, kind: 'helpline' })
    }
  }

  const apiReturnedRows = flat.length > 0
  if (!resources.length) {
    return { topic, resources: [], error: 'Could not load helplines right now.' }
  }
  return {
    topic,
    resources,
    error: apiReturnedRows ? undefined : 'Directory search returned no matches; showing core crisis lines.',
  }
}

async function fetchHelplines(
  place: GeoPlace,
  topic: 'suicide' | 'mental_health',
  contactMethod: ContactMethodPreference,
  signal?: AbortSignal,
): Promise<LocalResourceFetchResult> {
  const flat = await runConsolidatedHelplineQueries(place, [topic], contactMethod, signal)
  const merged = mergeHelplineRows(flat, place, 12)
  const resources = merged.map(mapHelpline)
  appendHelplineSupplements(flat, place, resources)
  if (!resources.length) {
    return { topic, resources: [], error: 'Could not load helplines right now.' }
  }
  return { topic, resources }
}

type FeedamResource = {
  id: number
  name: string
  address?: string
  city?: string
  state?: string
  zip?: string
  phone?: string | null
  website?: string | null
  resource_type?: string
  distance?: number
}

async function fetchFoodResources(place: GeoPlace): Promise<LocalResourceFetchResult> {
  const topic: ResourceTopic = 'food'
  if (place.countryCode !== 'US') {
    return { topic, resources: [], error: 'Food pantry search is available in the US only.' }
  }
  const url = new URL('https://feedam.org/api/resources/search')
  if (place.zip) {
    url.searchParams.set('zip', place.zip)
  } else if (place.latitude !== 0 || place.longitude !== 0) {
    url.searchParams.set('lat', String(place.latitude))
    url.searchParams.set('lng', String(place.longitude))
  } else {
    return {
      topic,
      resources: [],
      error: 'Add a ZIP code or choose a place on the map to search food pantries.',
    }
  }
  url.searchParams.set('mode', 'free')
  url.searchParams.set('radius', '25')

  const res = await fetch(url.toString())
  if (!res.ok) {
    return { topic, resources: [], error: 'Could not load nearby food resources.' }
  }
  const data = await parseJsonResponse<{ resources?: FeedamResource[] }>(res)
  const rows = filterByLocalArea(
    data?.resources ?? [],
    place,
    (row) => [row.name, row.city, row.state, row.address].filter(Boolean).join(' '),
    { maxDistanceMiles: 30, getDistance: (row) => row.distance ?? undefined },
  )
    .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999))
    .slice(0, 6)
  const resources = rows.map((row) => {
    const addressParts = [row.address, row.city, row.state, row.zip].filter(Boolean)
    return {
      id: `feedam-${row.id}`,
      kind: 'food' as const,
      name: row.name,
      description:
        row.distance != null ? `About ${row.distance.toFixed(1)} mi away` : row.resource_type,
      phone: row.phone ?? undefined,
      website: row.website ?? undefined,
      address: addressParts.join(', '),
      sourceLabel: 'Feed America (feedam.org)',
    }
  })
  return { topic, resources }
}

type HudAgency = {
  agcid?: string
  nme?: string
  phone1?: string
  weburl?: string
  adr1?: string
  city?: string
  statecd?: string
  zipcd?: string
  counslg_METHOD?: string
}

async function fetchShelterResources(place: GeoPlace): Promise<LocalResourceFetchResult> {
  const topic: ResourceTopic = 'shelter'
  if (place.countryCode !== 'US') {
    return { topic, resources: [], error: 'HUD housing counseling search is available in the US only.' }
  }

  const hasCoords =
    Number.isFinite(place.latitude) &&
    Number.isFinite(place.longitude) &&
    !(place.latitude === 0 && place.longitude === 0)
  if (!hasCoords) {
    return {
      topic,
      resources: [],
      error: 'Allow location or add a city/ZIP to search nearby HUD housing counselors.',
    }
  }

  const url = new URL('https://data.hud.gov/Housing_Counselor/searchByLocation')
  url.searchParams.set('Lat', String(place.latitude))
  url.searchParams.set('Long', String(place.longitude))
  url.searchParams.set('Distance', '20')
  const res = await fetch(url.toString())

  if (!res.ok) {
    return { topic, resources: [], error: 'Could not load HUD housing counselors.' }
  }
  const rows = await parseJsonResponse<HudAgency[] | unknown>(res)
  const filtered = filterByLocalArea(
    Array.isArray(rows) ? rows : [],
    place,
    (row) => [row.nme, row.city, row.statecd, row.adr1].filter(Boolean).join(' '),
  ).slice(0, 6)
  const resources = filtered.map((row) => {
    const addressParts = [row.adr1, row.city, row.statecd, row.zipcd].filter(Boolean)
    const web = row.weburl && row.weburl !== 'N/A' ? row.weburl : undefined
    return {
      id: `hud-${row.agcid ?? row.nme ?? Math.random()}`,
      kind: 'housing' as const,
      name: row.nme ?? 'HUD housing counseling agency',
      description: row.counslg_METHOD,
      phone: row.phone1,
      website: web,
      address: addressParts.join(', '),
      sourceLabel: 'HUD Housing Counseling',
    }
  })
  return { topic, resources }
}

export function topicsForCountry(countryCode: string, topics: ResourceTopic[]): ResourceTopic[] {
  const code = countryCode.trim().toUpperCase()
  const helplineTopics = topics.filter((topic) => topic === 'suicide' || topic === 'mental_health')
  if (code === 'US') {
    return topics.length ? topics : ['mental_health']
  }
  return helplineTopics.length ? helplineTopics : ['mental_health']
}

async function parseJsonResponse<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T
  } catch {
    return null
  }
}

export async function fetchResourcesForTopics(input: {
  place: GeoPlace
  topics: ResourceTopic[]
  contactMethod: ContactMethodPreference
  signal?: AbortSignal
}): Promise<LocalResourceFetchResult[]> {
  const { place, contactMethod, signal } = input
  const topics = topicsForCountry(place.countryCode, input.topics)
  const tasks: Promise<LocalResourceFetchResult>[] = []

  const wantsHelplines = topics.includes('suicide') || topics.includes('mental_health')
  if (wantsHelplines) {
    tasks.push(
      fetchCombinedHelplines(
        place,
        topics.includes('suicide'),
        topics.includes('mental_health'),
        contactMethod,
        signal,
      ),
    )
  }
  if (topics.includes('food')) {
    tasks.push(fetchFoodResources(place))
  }
  if (topics.includes('shelter')) {
    tasks.push(fetchShelterResources(place))
  }

  if (tasks.length === 0) {
    tasks.push(fetchHelplines(place, 'mental_health', contactMethod, signal))
  }

  return Promise.all(tasks)
}

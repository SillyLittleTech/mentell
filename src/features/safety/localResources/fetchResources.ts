import type {
  ContactMethodPreference,
  GeoPlace,
  LocalResource,
  LocalResourceFetchResult,
  ResourceTopic,
} from './types'

type HelplineContact = {
  phone?: string | null
  sms?: string | null
  chat_url?: string | null
  email?: string | null
}

type HelplineResult = {
  id: string
  name: string
  description?: string
  contact?: HelplineContact
  hours?: string
  website?: string
}

function helplineContactMethodParam(pref: ContactMethodPreference) {
  if (pref === 'phone') return 'phone'
  if (pref === 'sms') return 'sms'
  if (pref === 'chat') return 'chat'
  return null
}

function mapHelpline(row: HelplineResult): LocalResource {
  return {
    id: `gh-${row.id}`,
    kind: 'helpline',
    name: row.name,
    description: row.description,
    phone: row.contact?.phone ?? undefined,
    sms: row.contact?.sms ?? undefined,
    chatUrl: row.contact?.chat_url ?? undefined,
    website: row.website,
    hours: row.hours,
    sourceLabel: 'Global Helplines',
  }
}

async function fetchHelplines(
  place: GeoPlace,
  topic: 'suicide' | 'mental_health',
  contactMethod: ContactMethodPreference,
): Promise<LocalResourceFetchResult> {
  if (place.countryCode !== 'US') {
    return {
      topic,
      resources: [],
      error: 'Helpline directory is configured for US regions. Try Find A Helpline below.',
    }
  }
  const url = new URL('https://globalhelplines.org/v1/helplines')
  url.searchParams.set('country', 'US')
  url.searchParams.set('topic', topic)
  if (place.regionCode) url.searchParams.set('region', place.regionCode)
  const method = helplineContactMethodParam(contactMethod)
  if (method) url.searchParams.set('contact_method', method)

  const res = await fetch(url.toString())
  if (!res.ok) {
    return { topic, resources: [], error: 'Could not load helplines right now.' }
  }
  const data = (await res.json()) as { results?: HelplineResult[] }
  const resources = (data.results ?? []).slice(0, 8).map(mapHelpline)
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
    return { topic, resources: [], error: 'Food pantry search is US-only.' }
  }
  const url = new URL('https://feedam.org/api/resources/search')
  if (place.zip) {
    url.searchParams.set('zip', place.zip)
  } else {
    url.searchParams.set('lat', String(place.latitude))
    url.searchParams.set('lng', String(place.longitude))
  }
  url.searchParams.set('mode', 'free')
  url.searchParams.set('radius', '25')

  const res = await fetch(url.toString())
  if (!res.ok) {
    return { topic, resources: [], error: 'Could not load nearby food resources.' }
  }
  const data = (await res.json()) as { resources?: FeedamResource[] }
  const resources = (data.resources ?? []).slice(0, 6).map((row) => {
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
    return { topic, resources: [], error: 'HUD housing counseling search is US-only.' }
  }
  const url = new URL('https://data.hud.gov/Housing_Counselor/searchByLocation')
  url.searchParams.set('Lat', String(place.latitude))
  url.searchParams.set('Long', String(place.longitude))
  url.searchParams.set('Distance', '25')

  const res = await fetch(url.toString())
  if (!res.ok) {
    return { topic, resources: [], error: 'Could not load HUD housing counselors.' }
  }
  const rows = (await res.json()) as HudAgency[]
  const resources = (Array.isArray(rows) ? rows : []).slice(0, 6).map((row) => {
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

export function staticUsResources(): LocalResource[] {
  return [
    {
      id: 'static-988',
      kind: 'static',
      name: '988 Suicide & Crisis Lifeline',
      description: 'Free, confidential support 24/7 in the US.',
      phone: '988',
      sms: '988',
      chatUrl: 'https://988lifeline.org/chat/',
      website: 'https://988lifeline.org/',
      hours: '24/7',
      sourceLabel: 'US 988 Lifeline',
    },
    {
      id: 'static-nami',
      kind: 'static',
      name: 'NAMI HelpLine',
      description: 'Information, resource referrals, and support for mental health.',
      phone: '1-800-950-6264',
      website: 'https://www.nami.org/help',
      hours: 'Mon–Fri, 10am–10pm ET',
      sourceLabel: 'NAMI',
    },
    {
      id: 'static-211',
      kind: 'static',
      name: '211 (local services)',
      description: 'Dial 211 for food, housing, utilities, and other community help in many US areas.',
      phone: '211',
      website: 'https://www.211.org/',
      sourceLabel: 'United Way 211',
    },
  ]
}

export async function fetchResourcesForTopics(input: {
  place: GeoPlace
  topics: ResourceTopic[]
  contactMethod: ContactMethodPreference
}): Promise<LocalResourceFetchResult[]> {
  const { place, topics, contactMethod } = input
  const tasks: Promise<LocalResourceFetchResult>[] = []

  if (topics.includes('suicide')) {
    tasks.push(fetchHelplines(place, 'suicide', contactMethod))
  }
  if (topics.includes('mental_health') && !topics.includes('suicide')) {
    tasks.push(fetchHelplines(place, 'mental_health', contactMethod))
  } else if (topics.includes('mental_health') && topics.includes('suicide')) {
    tasks.push(fetchHelplines(place, 'mental_health', contactMethod))
  }
  if (topics.includes('food')) {
    tasks.push(fetchFoodResources(place))
  }
  if (topics.includes('shelter')) {
    tasks.push(fetchShelterResources(place))
  }

  if (tasks.length === 0) {
    tasks.push(fetchHelplines(place, 'mental_health', contactMethod))
  }

  return Promise.all(tasks)
}

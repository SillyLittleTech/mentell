import type { GeoPlace, LocalResource } from './types'

export type HelplineRow = {
  id: string
  name: string
  description?: string
  coverage?: string
  contact?: {
    phone?: string | null
    sms?: string | null
    chat_url?: string | null
  }
  hours?: string
  website?: string
}

function normalizeToken(value: string) {
  return value.trim().toLowerCase()
}

export function countyStem(county: string | undefined) {
  if (!county) return undefined
  return county.replace(/\s+county$/i, '').trim()
}

export function scoreHelpline(row: HelplineRow, place: GeoPlace): number {
  let score = 0
  const name = normalizeToken(row.name)
  const description = normalizeToken(row.description ?? '')
  const city = place.city ? normalizeToken(place.city) : ''
  const county = countyStem(place.county)
  const countyNorm = county ? normalizeToken(county) : ''

  if (city && (name.includes(city) || description.includes(city))) score += 120
  if (countyNorm && (name.includes(countyNorm) || description.includes(countyNorm))) score += 90

  const coverage = normalizeToken(row.coverage ?? '')
  if (coverage.startsWith('regional')) score += 35
  if (coverage === 'national') score -= 45

  // Deprioritize lines clearly tied to a different metro when we know the user's city.
  if (city === 'altoona' && name.includes('allegheny')) score -= 70
  if (city && name.includes('county') && countyNorm && !name.includes(countyNorm)) score -= 25

  return score
}

export function mergeHelplineRows(rows: HelplineRow[], place: GeoPlace, limit = 8): HelplineRow[] {
  const byId = new Map<string, HelplineRow>()
  for (const row of rows) {
    if (!row.id) continue
    byId.set(row.id, row)
  }
  return [...byId.values()]
    .sort((a, b) => scoreHelpline(b, place) - scoreHelpline(a, place))
    .slice(0, limit)
}

export function splitHelplineResources(resources: LocalResource[], place: GeoPlace) {
  const local: LocalResource[] = []
  const broader: LocalResource[] = []
  const city = place.city ? normalizeToken(place.city) : ''
  const county = countyStem(place.county)
  const countyNorm = county ? normalizeToken(county) : ''

  for (const resource of resources) {
    const blob = normalizeToken(`${resource.name} ${resource.description ?? ''}`)
    const isNational = blob.includes('nationwide')
    const isLocal =
      !isNational &&
      ((city && blob.includes(city)) ||
        (countyNorm && blob.includes(countyNorm)) ||
        blob.includes('regional ·'))
    if (isLocal) {
      local.push(resource)
    } else {
      broader.push(resource)
    }
  }

  return {
    local,
    broader,
  }
}

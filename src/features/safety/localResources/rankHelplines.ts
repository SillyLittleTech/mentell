import { referencesForeignCounty } from './geoFilter'
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

export function effectiveCity(place: GeoPlace) {
  if (place.city?.trim()) return normalizeToken(place.city)
  const first = place.displayName?.split(',')[0]?.trim()
  return first ? normalizeToken(first) : ''
}

function isEssentialNationalLine(row: HelplineRow) {
  const name = normalizeToken(row.name)
  return (
    name.includes('988') ||
    name.includes('crisis text line') ||
    name.includes('samhsa national helpline') ||
    name.includes('veterans crisis line')
  )
}

function isSchoolTipLine(row: HelplineRow) {
  const blob = normalizeToken(`${row.name} ${row.description ?? ''}`)
  return blob.includes('safe2say') || blob.includes('school safety tip')
}

export function scoreHelpline(row: HelplineRow, place: GeoPlace): number {
  let score = 0
  const name = normalizeToken(row.name)
  const description = normalizeToken(row.description ?? '')
  const city = effectiveCity(place)
  const county = countyStem(place.county)
  const countyNorm = county ? normalizeToken(county) : ''

  if (city && (name.includes(city) || description.includes(city))) score += 120
  if (countyNorm && (name.includes(countyNorm) || description.includes(countyNorm))) score += 90

  const coverage = normalizeToken(row.coverage ?? '')
  if (coverage.startsWith('regional')) score += 35
  if (coverage === 'national') score += 10
  if (isEssentialNationalLine(row)) score += 50

  if (isSchoolTipLine(row)) score -= 100
  if (city === 'altoona' && name.includes('allegheny')) score -= 70
  if (city && name.includes('county') && countyNorm && !name.includes(countyNorm)) score -= 25

  return score
}

export function mergeHelplineRows(rows: HelplineRow[], place: GeoPlace, limit = 12): HelplineRow[] {
  const byId = new Map<string, HelplineRow>()
  for (const row of rows) {
    if (!row.id) continue
    byId.set(row.id, row)
  }

  const sorted = [...byId.values()]
    .filter((row) => !referencesForeignCounty(`${row.name} ${row.description ?? ''}`, place))
    .filter((row) => !isSchoolTipLine(row))
    .sort((a, b) => scoreHelpline(b, place) - scoreHelpline(a, place))

  const picked: HelplineRow[] = []
  const seen = new Set<string>()
  const add = (row: HelplineRow) => {
    if (seen.has(row.id)) return
    seen.add(row.id)
    picked.push(row)
  }

  for (const row of sorted) {
    if (scoreHelpline(row, place) >= 40) add(row)
  }
  for (const row of sorted) {
    if (isEssentialNationalLine(row)) add(row)
  }
  for (const row of sorted) {
    add(row)
    if (picked.length >= limit) break
  }

  return picked.slice(0, limit)
}

export function splitHelplineResources(resources: LocalResource[], place: GeoPlace) {
  const local: LocalResource[] = []
  const broader: LocalResource[] = []
  const city = effectiveCity(place)
  const county = countyStem(place.county)
  const countyNorm = county ? normalizeToken(county) : ''

  for (const resource of resources) {
    const blob = normalizeToken(`${resource.name} ${resource.description ?? ''} ${resource.address ?? ''}`)
    if (referencesForeignCounty(`${resource.name} ${resource.description ?? ''} ${resource.address ?? ''}`, place)) {
      continue
    }
    const isNational =
      blob.includes('nationwide') ||
      blob.includes('988 suicide') ||
      blob.includes('nami helpline')
    const isLocal =
      !isNational &&
      ((city && blob.includes(city)) ||
        (city === 'altoona' && blob.includes('blair')) ||
        (countyNorm && blob.includes(countyNorm)) ||
        (countyNorm && blob.includes(`${countyNorm} county`)))
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

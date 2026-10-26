import { countyStem } from './rankHelplines'
import type { GeoPlace } from './types'

const COUNTY_IN_TEXT = /\b([a-z][a-z'.\s-]+?)\s+county\b/gi

function normalize(value: string) {
  return value.trim().toLowerCase()
}

export function referencesForeignCounty(text: string, place: GeoPlace) {
  const home = countyStem(place.county)
  if (!home) return false
  const homeNorm = normalize(home)
  let match: RegExpExecArray | null
  COUNTY_IN_TEXT.lastIndex = 0
  while ((match = COUNTY_IN_TEXT.exec(text))) {
    const mentioned = normalize(match[1].replace(/\s+/g, ' '))
    if (mentioned && mentioned !== homeNorm) return true
  }
  return false
}

export function filterByLocalArea<T>(
  items: T[],
  place: GeoPlace,
  toText: (item: T) => string,
  options?: { maxDistanceMiles?: number; getDistance?: (item: T) => number | undefined },
) {
  const city = place.city ? normalize(place.city) : ''
  const county = countyStem(place.county)
  const countyNorm = county ? normalize(county) : ''
  const maxDistance = options?.maxDistanceMiles ?? 35
  const hasLocalAnchor = Boolean(city || countyNorm)

  return items.filter((item) => {
    const text = toText(item)
    const lower = text.toLowerCase()
    if (referencesForeignCounty(text, place)) return false

    const distance = options?.getDistance?.(item)
    if (distance != null) return distance <= maxDistance

    if (city && lower.includes(city)) return true
    if (countyNorm && (lower.includes(countyNorm) || lower.includes(`${countyNorm} county`))) return true

    return !hasLocalAnchor
  })
}

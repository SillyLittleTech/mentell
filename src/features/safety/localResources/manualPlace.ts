import { appVersion } from '../../../shared/version'
import type { GeoPlace } from './types'

export type ManualLocationFields = {
  countryCode: string
  regionCode?: string
  zip?: string
  placeLabel?: string
}

export const COMMON_COUNTRY_OPTIONS: { code: string; label: string }[] = [
  { code: 'US', label: 'United States' },
  { code: 'CA', label: 'Canada' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'AU', label: 'Australia' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'MX', label: 'Mexico' },
  { code: 'IN', label: 'India' },
  { code: 'BR', label: 'Brazil' },
  { code: 'OTHER', label: 'Other (enter code below)' },
]

async function forwardGeocode(query: string): Promise<GeoPlace | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': `Mentell/${appVersion} (local resources; contact@slt.ong)` },
  })
  if (!res.ok) return null
  const rows = (await res.json()) as {
    lat?: string
    lon?: string
    display_name?: string
    address?: Record<string, string | undefined>
  }[]
  const hit = rows[0]
  if (!hit?.lat || !hit?.lon) return null
  const countryCode = (hit.address?.country_code ?? '').toUpperCase()
  const isoRegion = hit.address?.['ISO3166-2-lvl4']
  const regionFromIso =
    isoRegion && isoRegion.includes('-') ? isoRegion.split('-')[1]?.toUpperCase() : undefined
  return {
    latitude: Number(hit.lat),
    longitude: Number(hit.lon),
    countryCode: countryCode || 'US',
    regionCode: regionFromIso,
    city: hit.address?.city ?? hit.address?.town ?? hit.address?.village,
    county: hit.address?.county,
    zip: hit.address?.postcode,
    displayName: hit.display_name,
  }
}

export async function placeFromManual(fields: ManualLocationFields): Promise<GeoPlace> {
  const countryCode = fields.countryCode.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    throw new Error('Enter a two-letter country code (for example US, CA, GB).')
  }

  const parts = [fields.placeLabel, fields.regionCode, fields.zip, countryCode].filter(Boolean)
  const query = parts.join(', ')
  const geocoded = query ? await forwardGeocode(query) : null
  if (geocoded) {
    return {
      ...geocoded,
      countryCode: geocoded.countryCode || countryCode,
      regionCode: fields.regionCode?.trim().toUpperCase() || geocoded.regionCode,
      zip: fields.zip?.trim() || geocoded.zip,
      displayName: geocoded.displayName ?? query,
    }
  }

  return {
    latitude: 0,
    longitude: 0,
    countryCode,
    regionCode: fields.regionCode?.trim().toUpperCase() || undefined,
    city: fields.placeLabel?.trim() || undefined,
    zip: fields.zip?.trim() || undefined,
    displayName: query || countryCode,
  }
}

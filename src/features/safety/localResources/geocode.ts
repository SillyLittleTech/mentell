import { appVersion } from '../../../shared/version'
import { isDebugMode } from '../../../shared/debug/debugFlags'
import { loadDebugLocationOverride, debugOverrideToGeoPlace } from './debugLocation'
import type { GeoPlace } from './types'

function usStateToCode(stateName: string | undefined): string | undefined {
  if (!stateName) return undefined
  const trimmed = stateName.trim()
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase()
  const map: Record<string, string> = {
    alabama: 'AL',
    alaska: 'AK',
    arizona: 'AZ',
    arkansas: 'AR',
    california: 'CA',
    colorado: 'CO',
    connecticut: 'CT',
    delaware: 'DE',
    'district of columbia': 'DC',
    florida: 'FL',
    georgia: 'GA',
    hawaii: 'HI',
    idaho: 'ID',
    illinois: 'IL',
    indiana: 'IN',
    iowa: 'IA',
    kansas: 'KS',
    kentucky: 'KY',
    louisiana: 'LA',
    maine: 'ME',
    maryland: 'MD',
    massachusetts: 'MA',
    michigan: 'MI',
    minnesota: 'MN',
    mississippi: 'MS',
    missouri: 'MO',
    montana: 'MT',
    nebraska: 'NE',
    nevada: 'NV',
    'new hampshire': 'NH',
    'new jersey': 'NJ',
    'new mexico': 'NM',
    'new york': 'NY',
    'north carolina': 'NC',
    'north dakota': 'ND',
    ohio: 'OH',
    oklahoma: 'OK',
    oregon: 'OR',
    pennsylvania: 'PA',
    'rhode island': 'RI',
    'south carolina': 'SC',
    'south dakota': 'SD',
    tennessee: 'TN',
    texas: 'TX',
    utah: 'UT',
    vermont: 'VT',
    virginia: 'VA',
    washington: 'WA',
    'west virginia': 'WV',
    wisconsin: 'WI',
    wyoming: 'WY',
  }
  return map[trimmed.toLowerCase()]
}

function looksLikeUnitedStates(latitude: number, longitude: number) {
  return latitude >= 18 && latitude <= 72 && longitude >= -172 && longitude <= -65
}

async function reverseGeocode(latitude: number, longitude: number): Promise<GeoPlace> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.searchParams.set('lat', String(latitude))
  url.searchParams.set('lon', String(longitude))
  url.searchParams.set('format', 'json')

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': `Mentell/${appVersion} (local resources; contact@slt.ong)` },
  })
  if (!res.ok) {
    throw new Error('Could not look up your area from coordinates.')
  }
  const data = (await res.json()) as {
    display_name?: string
    address?: Record<string, string | undefined>
  }
  const countryCode = (data.address?.country_code ?? 'us').toUpperCase()
  const isoRegion = data.address?.['ISO3166-2-lvl4']
  const regionFromIso =
    isoRegion && isoRegion.includes('-') ? isoRegion.split('-')[1]?.toUpperCase() : undefined
  const regionCode =
    countryCode === 'US' ? regionFromIso ?? usStateToCode(data.address?.state) : regionFromIso
  return {
    latitude,
    longitude,
    countryCode,
    regionCode,
    city: data.address?.city ?? data.address?.town ?? data.address?.village,
    county: data.address?.county,
    zip: data.address?.postcode,
    displayName: data.display_name,
  }
}

async function enrichPlace(base: GeoPlace): Promise<GeoPlace> {
  if (!Number.isFinite(base.latitude) || !Number.isFinite(base.longitude)) return base
  if (base.latitude === 0 && base.longitude === 0) return base
  try {
    const enriched = await reverseGeocode(base.latitude, base.longitude)
    return {
      ...enriched,
      countryCode: base.countryCode || enriched.countryCode,
      regionCode: base.regionCode || enriched.regionCode,
      city: base.city || enriched.city,
      county: base.county || enriched.county,
      zip: base.zip || enriched.zip,
    }
  } catch {
    return base
  }
}

function resolveFromDevice(): Promise<GeoPlace> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is unavailable in this browser.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords
          const place = await reverseGeocode(latitude, longitude)
          if (place.countryCode === 'US' || looksLikeUnitedStates(latitude, longitude)) {
            resolve({ ...place, countryCode: 'US' })
          } else {
            resolve(place)
          }
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Location lookup failed.'))
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error('Location was not shared.'))
          return
        }
        reject(new Error('Could not read your location.'))
      },
      { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: 12000 },
    )
  })
}

export async function resolveCoordinates(): Promise<GeoPlace> {
  try {
    return await resolveFromDevice()
  } catch (deviceError) {
    const override = isDebugMode() ? loadDebugLocationOverride() : null
    if (override) {
      return enrichPlace(debugOverrideToGeoPlace(override))
    }
    throw deviceError
  }
}

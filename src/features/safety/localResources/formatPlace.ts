import { isDebugMode } from '../../../shared/debug/debugFlags'
import { COMMON_COUNTRY_OPTIONS } from './manualPlace'
import type { GeoPlace } from './types'

function countryLabel(code: string | undefined) {
  if (!code) return undefined
  const upper = code.toUpperCase()
  return COMMON_COUNTRY_OPTIONS.find((option) => option.code === upper)?.label ?? upper
}

export function formatPublicPlaceLabel(place: GeoPlace | null | undefined): string | undefined {
  if (!place) return undefined

  const city = place.city?.trim()
  const region = place.regionCode?.trim()
  const country = countryLabel(place.countryCode)

  if (city && region && country) return `${city}, ${region}, ${country}`
  if (city && region) return `${city}, ${region}`
  if (region && country) return `${region}, ${country}`
  if (city && country) return `${city}, ${country}`

  const display = place.displayName?.trim()
  if (display && (isDebugMode() || !/debug/i.test(display))) {
    return display
  }

  return country || undefined
}

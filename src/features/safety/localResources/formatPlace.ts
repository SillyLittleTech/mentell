import { isDebugMode } from '../../../shared/debug/debugFlags'
import type { GeoPlace } from './types'

export function formatPublicPlaceLabel(place: GeoPlace | null | undefined): string | undefined {
  if (!place) return undefined

  const city = place.city?.trim()
  const region = place.regionCode?.trim()
  const country = place.countryCode?.trim()

  if (city && region) return `${city}, ${region}`
  if (city && country) return `${city}, ${country}`
  if (region && country) return `${region}, ${country}`

  const display = place.displayName?.trim()
  if (display && (isDebugMode() || !/debug/i.test(display))) {
    return display
  }

  return country || undefined
}

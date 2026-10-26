import { scopedStorageKey } from '../../../shared/storage/storageScope'
import type { GeoPlace } from './types'

const KEY = scopedStorageKey('mentell.debug.locationOverride')

export type DebugLocationOverride = {
  enabled: boolean
  latitude: number
  longitude: number
  regionCode?: string
  zip?: string
  label?: string
}

export function loadDebugLocationOverride(): DebugLocationOverride | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DebugLocationOverride
    if (!parsed.enabled) return null
    if (!Number.isFinite(parsed.latitude) || !Number.isFinite(parsed.longitude)) return null
    return parsed
  } catch {
    return null
  }
}

export function saveDebugLocationOverride(value: DebugLocationOverride) {
  localStorage.setItem(KEY, JSON.stringify(value))
}

export function clearDebugLocationOverride() {
  localStorage.removeItem(KEY)
}

export function debugOverrideToGeoPlace(override: DebugLocationOverride): GeoPlace {
  return {
    latitude: override.latitude,
    longitude: override.longitude,
    countryCode: 'US',
    regionCode: override.regionCode?.toUpperCase(),
    zip: override.zip,
    displayName: override.label ?? 'Debug location',
  }
}

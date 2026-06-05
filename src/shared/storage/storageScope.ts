import { isDebugMode } from '../debug/debugFlags'

const DEBUG_DATA_PREFIX = 'mentell.debug-data.'

export function isDebugStorageScope() {
  return isDebugMode()
}

export function dexieDatabaseName() {
  return isDebugStorageScope() ? 'mentell-debug' : 'mentell'
}

/** Prefix journal-related localStorage keys in debug builds. */
export function scopedStorageKey(base: string) {
  if (!isDebugStorageScope()) return base
  if (base.startsWith(DEBUG_DATA_PREFIX)) return base
  return `${DEBUG_DATA_PREFIX}${base}`
}

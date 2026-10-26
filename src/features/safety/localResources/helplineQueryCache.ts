type CacheEntry = {
  expiresAt: number
  results: unknown[]
}

const cache = new Map<string, CacheEntry>()
const FAIL_TTL_MS = 45_000
const OK_TTL_MS = 5 * 60_000

function cacheKey(url: string) {
  return url
}

export function readHelplineCache<T>(url: string): T[] | null {
  const entry = cache.get(cacheKey(url))
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(cacheKey(url))
    return null
  }
  return entry.results as T[]
}

export function writeHelplineCache(url: string, results: unknown[], ok: boolean) {
  cache.set(cacheKey(url), {
    results,
    expiresAt: Date.now() + (ok ? OK_TTL_MS : FAIL_TTL_MS),
  })
}

export function clearHelplineQueryCache() {
  cache.clear()
}

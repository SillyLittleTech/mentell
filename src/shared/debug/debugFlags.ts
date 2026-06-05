const SLOWMO_KEY = 'mentell.debug.slowmo'
const FORCE_PACKAGES_KEY = 'mentell.debug.forcePackages'
const SKIP_AI_CACHE_KEY = 'mentell.debug.skipAiCache'

export function isDebugMode() {
  return import.meta.env.MODE === 'debug'
}

export function getSlowMo() {
  const raw = localStorage.getItem(SLOWMO_KEY)
  const n = raw ? Number(raw) : 1
  if (!Number.isFinite(n) || n <= 0) return 1
  return Math.min(8, Math.max(0.25, n))
}

export function setSlowMo(mult: number) {
  localStorage.setItem(SLOWMO_KEY, String(mult))
}

export function getForcePackages() {
  return localStorage.getItem(FORCE_PACKAGES_KEY) === '1'
}

export function setForcePackages(v: boolean) {
  localStorage.setItem(FORCE_PACKAGES_KEY, v ? '1' : '0')
}

export function getSkipAiCache() {
  return localStorage.getItem(SKIP_AI_CACHE_KEY) === '1'
}

export function setSkipAiCache(v: boolean) {
  localStorage.setItem(SKIP_AI_CACHE_KEY, v ? '1' : '0')
}


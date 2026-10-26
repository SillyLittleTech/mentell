function normalizeEndpointUrl(endpoint: string) {
  return endpoint.replace(/\/+$/, '')
}

<<<<<<< HEAD
const WORKER_ROUTE_SUFFIXES = [
  '/weekly-summary',
  '/risk-assessment',
  '/pooled-crisis-resources',
  '/projector-search',
] as const

function stripKnownWorkerRoutes(base: string) {
  let out = normalizeEndpointUrl(base)
  for (const suffix of WORKER_ROUTE_SUFFIXES) {
    if (out.endsWith(suffix)) {
      out = out.slice(0, -suffix.length)
      out = normalizeEndpointUrl(out)
    }
  }
  return out
}

function firstNonEmptyEnv(...keys: string[]) {
  for (const key of keys) {
    const value = (import.meta.env as Record<string, string | undefined>)[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

/** Worker origin from weekly AI endpoint, push API base, or projector search endpoint. */
export function workerBaseUrl(): string | null {
  const raw = firstNonEmptyEnv(
    'VITE_WEEKLY_AI_ENDPOINT',
    'VITE_PUSH_API_BASE',
    'VITE_PROJECTOR_SEARCH_ENDPOINT',
  )
  if (!raw) return null
  return stripKnownWorkerRoutes(raw)
}

/** Resolve a Worker subpath from configured Mentell Worker URLs. */
export function resolveWorkerRoute(subpath: string) {
  const base = workerBaseUrl()
  if (!base) return null
  const path = subpath.startsWith('/') ? subpath : `/${subpath}`
=======
/** Resolve a Worker subpath from VITE_WEEKLY_AI_ENDPOINT (weekly-summary, risk-assessment, or worker origin). */
export function resolveWorkerRoute(subpath: string) {
  const raw = import.meta.env.VITE_WEEKLY_AI_ENDPOINT
  if (typeof raw !== 'string' || !raw.trim()) return null
  const path = subpath.startsWith('/') ? subpath : `/${subpath}`
  const base = normalizeEndpointUrl(raw.trim())
  if (base.endsWith('/weekly-summary')) {
    return base.replace(/\/weekly-summary\/?$/, path)
  }
  if (base.endsWith('/risk-assessment')) {
    return base.replace(/\/risk-assessment\/?$/, path)
  }
  if (base.endsWith('/pooled-crisis-resources')) {
    return base.replace(/\/pooled-crisis-resources\/?$/, path)
  }
>>>>>>> origin/main
  return `${base}${path}`
}

export function normalizeEnvToken(raw: string | undefined) {
  if (!raw) return ''
  const t = raw.trim()
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1)
  }
  return t
}
<<<<<<< HEAD

export function workerAuthToken() {
  return (
    normalizeEnvToken(import.meta.env.VITE_WEEKLY_AI_TOKEN) ||
    normalizeEnvToken(import.meta.env.VITE_PROJECTOR_SEARCH_TOKEN)
  )
}
=======
>>>>>>> origin/main

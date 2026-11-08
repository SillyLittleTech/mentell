function normalizeEndpointUrl(endpoint: string) {
  return endpoint.replace(/\/+$/, '')
}

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

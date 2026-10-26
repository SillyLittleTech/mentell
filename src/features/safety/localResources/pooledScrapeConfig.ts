import { resolveWorkerRoute, workerAuthToken, workerBaseUrl } from './workerRoute'

function pooledCrisisResourcesEndpoint() {
  return resolveWorkerRoute('/pooled-crisis-resources')
}

export function isTruthyEnvFlag(value: string | undefined) {
  if (value == null) return false
  const v = value.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

export function isExplicitlyDisabledEnvFlag(value: string | undefined) {
  if (value == null) return false
  const v = value.trim().toLowerCase()
  return v === '0' || v === 'false' || v === 'no' || v === 'off'
}

/** Pooled AI runs when Worker URL + token are in the build and not explicitly disabled. */
export function isPooledScrapeConfigured() {
  if (isExplicitlyDisabledEnvFlag(import.meta.env.VITE_ENABLE_POOLED_CRISIS)) return false

  const endpoint = pooledCrisisResourcesEndpoint()
  const token = workerAuthToken()
  if (!endpoint || !token) return false

  if (isTruthyEnvFlag(import.meta.env.VITE_ENABLE_POOLED_CRISIS)) return true
  if (isTruthyEnvFlag(import.meta.env.VITE_ENABLE_WEEKLY_AI_SUMMARY)) return true

  // Endpoint + token in the build (e.g. GitHub Pages secret) — enable unless POOLED_CRISIS=0
  return true
}

export type PooledConfigIssue =
  | 'disabled_flag'
  | 'missing_worker_url'
  | 'missing_token'
  | 'missing_enable_flag'

export function diagnosePooledScrapeConfig(): { ok: boolean; issues: PooledConfigIssue[] } {
  const issues: PooledConfigIssue[] = []
  if (isExplicitlyDisabledEnvFlag(import.meta.env.VITE_ENABLE_POOLED_CRISIS)) {
    issues.push('disabled_flag')
  }
  if (!workerBaseUrl()) issues.push('missing_worker_url')
  if (!workerAuthToken()) issues.push('missing_token')
  if (!issues.length && !isPooledScrapeConfigured()) {
    issues.push('missing_enable_flag')
  }
  return { ok: issues.length === 0 && isPooledScrapeConfigured(), issues }
}

export function pooledScrapeConfigHint(issues: PooledConfigIssue[]) {
  if (!issues.length) return undefined
  const parts: string[] = []
  if (issues.includes('disabled_flag')) {
    parts.push('VITE_ENABLE_POOLED_CRISIS is off')
  }
  if (issues.includes('missing_worker_url')) {
    parts.push('set VITE_WEEKLY_AI_ENDPOINT (or VITE_PUSH_API_BASE) to your Worker origin')
  }
  if (issues.includes('missing_token')) {
    parts.push('set VITE_WEEKLY_AI_TOKEN at build time (GitHub secret WEEKLY_AI_TOKEN) and redeploy')
  }
  if (issues.includes('missing_enable_flag')) {
    parts.push('enable VITE_ENABLE_POOLED_CRISIS=1 or VITE_ENABLE_WEEKLY_AI_SUMMARY=1')
  }
  return parts.join('; ')
}

export function debugWorkerRoutes() {
  return {
    base: workerBaseUrl(),
    pooled: resolveWorkerRoute('/pooled-crisis-resources'),
    risk: resolveWorkerRoute('/risk-assessment'),
    hasToken: Boolean(workerAuthToken()),
  }
}

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  diagnosePooledScrapeConfig,
  isExplicitlyDisabledEnvFlag,
  isPooledScrapeConfigured,
  isTruthyEnvFlag,
} from './pooledScrapeConfig'
import { resolveWorkerRoute, workerBaseUrl } from './workerRoute'

describe('env flag helpers', () => {
  it('accepts common truthy values', () => {
    expect(isTruthyEnvFlag('1')).toBe(true)
    expect(isTruthyEnvFlag('true')).toBe(true)
    expect(isTruthyEnvFlag(' yes ')).toBe(true)
  })

  it('detects explicit disable', () => {
    expect(isExplicitlyDisabledEnvFlag('0')).toBe(true)
    expect(isExplicitlyDisabledEnvFlag('false')).toBe(true)
  })
})

describe('workerRoute', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_WEEKLY_AI_ENDPOINT', 'https://worker.example/weekly-summary')
    vi.stubEnv('VITE_WEEKLY_AI_TOKEN', 'secret-token')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('strips weekly-summary suffix for pooled route', () => {
    expect(workerBaseUrl()).toBe('https://worker.example')
    expect(resolveWorkerRoute('/pooled-crisis-resources')).toBe(
      'https://worker.example/pooled-crisis-resources',
    )
  })

  it('enables pooled when endpoint and token exist without weekly flag', () => {
    vi.stubEnv('VITE_ENABLE_WEEKLY_AI_SUMMARY', '0')
    vi.stubEnv('VITE_ENABLE_POOLED_CRISIS', '')
    expect(isPooledScrapeConfigured()).toBe(true)
    expect(diagnosePooledScrapeConfig().ok).toBe(true)
  })

  it('respects explicit pooled disable', () => {
    vi.stubEnv('VITE_ENABLE_POOLED_CRISIS', '0')
    expect(isPooledScrapeConfigured()).toBe(false)
    expect(diagnosePooledScrapeConfig().issues).toContain('disabled_flag')
  })
})

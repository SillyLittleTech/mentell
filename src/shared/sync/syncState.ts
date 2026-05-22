const SYNC_STATE_KEY = 'mentell.sync'

export type SyncState = {
  enabled: boolean
  lastSyncedAt: number | null
  lastError: string | null
}

const DEFAULT: SyncState = {
  enabled: false,
  lastSyncedAt: null,
  lastError: null,
}

export function loadSyncState(): SyncState {
  try {
    const raw = localStorage.getItem(SYNC_STATE_KEY)
    if (!raw) return { ...DEFAULT }
    const parsed = JSON.parse(raw) as Partial<SyncState>
    return {
      enabled: Boolean(parsed.enabled),
      lastSyncedAt:
        typeof parsed.lastSyncedAt === 'number' ? parsed.lastSyncedAt : null,
      lastError: typeof parsed.lastError === 'string' ? parsed.lastError : null,
    }
  } catch {
    return { ...DEFAULT }
  }
}

export function saveSyncState(patch: Partial<SyncState>) {
  const next = { ...loadSyncState(), ...patch }
  localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(next))
  return next
}

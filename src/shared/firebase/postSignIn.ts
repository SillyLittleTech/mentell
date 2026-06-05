import type { Auth } from 'firebase/auth'
import { isFirebaseSyncEnabled } from '../features/featureFlags'
import { enableSync } from '../sync/syncService'
import { loadSyncState, saveSyncState } from '../sync/syncState'

export type PostSignInCallbacks = {
  setSyncEnabled: (on: boolean) => void
  setSyncError: (msg: string | null) => void
  setLastSyncedAt: (ts: number | null) => void
}

export async function finishSignIn(auth: Auth, callbacks: PostSignInCallbacks) {
  if (isFirebaseSyncEnabled() && auth.currentUser) {
    saveSyncState({ enabled: true })
    callbacks.setSyncEnabled(true)
    await enableSync(auth.currentUser.uid)
    const s = loadSyncState()
    callbacks.setSyncError(s.lastError)
    callbacks.setLastSyncedAt(s.lastSyncedAt)
  }
  callbacks.setSyncError(null)
}

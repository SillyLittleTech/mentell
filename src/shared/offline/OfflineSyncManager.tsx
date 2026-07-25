import { useEffect } from 'react'
import { useOnlineStatus } from './useOnlineStatus'

import { useToast } from '../ui/useToast'
import { pushLocalChangesNow } from '../sync/syncService'
import { isFirebaseSyncEnabled } from '../features/featureFlags'
import { loadSyncState } from '../sync/syncState'

export function OfflineSyncManager() {
  const isOnline = useOnlineStatus()
  const { showToast, removeToast } = useToast()


  useEffect(() => {
    // Count unsynced entries. We'll simply count how many entries might be queued
    // (For Dexie, anything added while offline). We don't track explicitly un-synced
    // row by row right now, but we can do a rough check or just show a general
    // "Queued for sync" indicator. The user requested: "UI element that shows
    // the status of entries queued for sync". Since we don't have a specific `synced` flag
    // on EntryRow, we can just say "Changes queued for sync" in the toast.
    if (!isFirebaseSyncEnabled() || !loadSyncState().enabled) return

    let toastId: string | undefined

    if (!isOnline) {
      toastId = showToast({
        message: 'Offline mode: some features are limited. Changes will sync when reconnected.',
        isSticky: true,
      })
    } else {
      // Trigger a push to sync any queued changes since we are back online
      void pushLocalChangesNow()
    }

    return () => {
      if (toastId) removeToast(toastId)
    }
  }, [isOnline, showToast, removeToast])

  return null
}
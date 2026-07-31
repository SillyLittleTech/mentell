import { useEffect } from 'react'
import { useOnlineStatus } from './useOnlineStatus'
import { useToast } from '../ui/useToast'
import { pushLocalChangesNow } from '../sync/syncService'
import { isFirebaseSyncEnabled } from '../features/featureFlags'
import { loadSyncState } from '../sync/syncState'

function syncActive() {
  return isFirebaseSyncEnabled() && loadSyncState().enabled
}

export function OfflineSyncManager() {
  const isOnline = useOnlineStatus()
  const { showToast, removeToast } = useToast()

  useEffect(() => {
    let toastId: string | undefined

    if (!isOnline) {
      toastId = showToast({
        message: syncActive()
          ? 'Offline mode: some features are limited. Changes will sync when reconnected.'
          : 'Offline mode: some features are limited until you reconnect.',
        isSticky: true,
      })
    } else if (syncActive()) {
      void pushLocalChangesNow()
    }

    return () => {
      if (toastId) removeToast(toastId)
    }
  }, [isOnline, showToast, removeToast])

  return null
}

import { useSyncExternalStore } from 'react'
import {
  getOnlineStatus,
  subscribeOnlineStatus,
  notifyOnlineStatusListeners,
} from './onlineStatus'

function subscribe(onStoreChange: () => void) {
  const unsubForced = subscribeOnlineStatus(onStoreChange)

  function handleOnline() {
    notifyOnlineStatusListeners()
  }
  function handleOffline() {
    notifyOnlineStatusListeners()
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  return () => {
    unsubForced()
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}

export function useOnlineStatus() {
  return useSyncExternalStore(subscribe, getOnlineStatus, () => true)
}

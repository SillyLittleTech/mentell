type OnlineListener = () => void

const listeners = new Set<OnlineListener>()

/** Debug / tests: force online/offline without relying on navigator.onLine. */
let forcedOnline: boolean | null = null

export function getOnlineStatus(): boolean {
  return forcedOnline ?? (typeof navigator !== 'undefined' ? navigator.onLine : true)
}

export function setForcedOnlineStatus(value: boolean | null) {
  forcedOnline = value
  listeners.forEach((listener) => listener())
}

export function subscribeOnlineStatus(listener: OnlineListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function notifyOnlineStatusListeners() {
  listeners.forEach((listener) => listener())
}

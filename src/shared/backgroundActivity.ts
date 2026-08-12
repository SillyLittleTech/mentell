type ActivityEvent = { type: 'start' | 'stop'; message: string; id: string }
const listeners: Set<(event: ActivityEvent) => void> = new Set()

export function listenToBackgroundActivity(callback: (event: ActivityEvent) => void) {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

export function emitBackgroundActivity(event: ActivityEvent) {
  listeners.forEach((fn) => fn(event))
}

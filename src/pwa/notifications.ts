export async function requestNotificationsPermission() {
  if (!('Notification' in window)) return 'unsupported' as const
  const res = await Notification.requestPermission()
  return res
}

export function canNotify() {
  return 'Notification' in window && Notification.permission === 'granted'
}

export function notifyPackageArrived(title: string, body: string) {
  if (!canNotify()) return false
  // Best-effort: will only show while a page is open unless platform supports SW notifications without push.
  new Notification(title, { body })
  return true
}


import { loadAppSettings } from '../shared/settings/appSettings'
import { isWebPushConfigured, syncPushSubscription } from './pushSubscribe'

export async function requestNotificationsPermission() {
  if (!('Notification' in window)) return 'unsupported' as const
  const res = await Notification.requestPermission()
  return res
}

export function notificationPermission() {
  if (!('Notification' in window)) return 'unsupported' as const
  return Notification.permission
}

export function canNotify() {
  return 'Notification' in window && Notification.permission === 'granted'
}

export function areNotificationsEnabled() {
  return !loadAppSettings().disableNotifications && canNotify()
}

/** Prompt once when notifications are enabled and permission is still default. */
export async function maybeRequestNotificationPermission() {
  const settings = loadAppSettings()
  if (settings.disableNotifications) return notificationPermission()
  if (!('Notification' in window)) return 'unsupported' as const
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  const res = await requestNotificationsPermission()
  if (res === 'granted' && isWebPushConfigured()) {
    void syncPushSubscription()
  }
  return res
}

export function notifyPackageArrived(title: string, body: string) {
  if (!areNotificationsEnabled()) return false
  new Notification(title, { body })
  return true
}

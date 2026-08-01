import { loadAppSettings } from '../shared/settings/appSettings'
import { isTauri } from '../shared/platform/runtime'
import { isWebPushConfigured, syncPushSubscription } from './pushSubscribe'

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported'

export async function requestNotificationsPermission(): Promise<NotificationPermissionState> {
  if (!('Notification' in window)) return 'unsupported'
  const res = await Notification.requestPermission()
  return res as NotificationPermissionState
}

export function notificationPermission(): NotificationPermissionState {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission as NotificationPermissionState
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
  if (res === 'granted' && isWebPushConfigured() && !isTauri()) {
    void syncPushSubscription()
  }
  return res
}

export function notifyPackageArrived(title: string, body: string) {
  if (!areNotificationsEnabled()) return false
  new Notification(title, { body })
  return true
}

/** User-facing hint when notification permission is denied. */
export function notificationPermissionDeniedHint(): string {
  if (isTauri()) {
    return 'Notifications are blocked for Mentell. Enable them in your system notification settings.'
  }
  return "Notifications are blocked in your browser. Enable them in your browser's site settings for this page."
}

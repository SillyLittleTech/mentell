import { loadAppSettings } from '../shared/settings/appSettings'
import { isTauri } from '../shared/platform/runtime'
import { publicUrl } from '../shared/publicUrl'
import { isWebPushConfigured, syncPushSubscription } from './pushSubscribe'
import { showTauriNotification, syncTauriDeliverySchedule } from './tauriNotifications'

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported'

export async function requestNotificationsPermission(): Promise<NotificationPermissionState> {
  if (isTauri()) {
    try {
      await syncTauriDeliverySchedule()
      return 'granted'
    } catch {
      return 'denied'
    }
  }
  if (!('Notification' in window)) return 'unsupported'
  const res = await Notification.requestPermission()
  return res as NotificationPermissionState
}

export function notificationPermission(): NotificationPermissionState {
  if (isTauri()) return 'granted'
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission as NotificationPermissionState
}

export function canNotify() {
  if (isTauri()) return true
  return 'Notification' in window && Notification.permission === 'granted'
}

export function areNotificationsEnabled() {
  return !loadAppSettings().disableNotifications && canNotify()
}

/** Prompt once when notifications are enabled and permission is still default. */
export async function maybeRequestNotificationPermission() {
  const settings = loadAppSettings()
  if (settings.disableNotifications) return notificationPermission()
  if (isTauri()) {
    const res = await requestNotificationsPermission()
    return res
  }
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
  void showOsNotification(title, body)
  return true
}

async function showOsNotification(title: string, body: string) {
  if (isTauri()) {
    try {
      await showTauriNotification(title, body)
    } catch {
      /* OS may still prompt on first schedule */
    }
    return
  }
  const url = new URL(publicUrl('week'), window.location.origin).href
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready
      await reg.showNotification(title, {
        body,
        tag: 'mentell-package',
        data: { url },
      })
      return
    }
  } catch {
    /* fall through */
  }
  try {
    new Notification(title, { body })
  } catch {
    /* Safari may throw without a gesture */
  }
}

/** User-facing hint when notification permission is denied. */
export function notificationPermissionDeniedHint(): string {
  if (isTauri()) {
    return 'Notifications are blocked for Mentell. Enable them in your system notification settings.'
  }
  return "Notifications are blocked in your browser. Enable them in your browser's site settings for this page."
}

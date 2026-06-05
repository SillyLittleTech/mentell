import { isDebugMode } from '../../shared/debug/debugFlags'
import { loadAppSettings } from '../../shared/settings/appSettings'
import {
  areNotificationsEnabled,
  notificationPermission,
  notifyPackageArrived,
  requestNotificationsPermission,
} from '../../pwa/notifications'
import {
  getPushClientId,
  isWebPushConfigured,
  sendWorkerPushTest,
  fetchWorkerPushStatus,
  sendWorkerPushTestDelayed,
  syncPushSubscriptionWithResult,
  unsubscribePush,
} from '../../pwa/pushSubscribe'
import { runPackageDeliveryAndNotify } from '../packages/runPackageDelivery'

export type NotificationDebugSnapshot = {
  permission: string
  enabledInApp: boolean
  disableNotifications: boolean
  webPushEnvConfigured: boolean
  pushApiBase: string
  vapidConfigured: boolean
  serviceWorkerSupported: boolean
  serviceWorkerRegistered: boolean
  serviceWorkerReady: boolean
  serviceWorkerState: string
  serviceWorkerScript: string
  pushSubscriptionActive: boolean
  pushClientId: string | null
  deliveryWeekday: number
  deliveryTimeLocal: string
  timezone: string
  debugMode: boolean
  workerVapidConfigured: boolean | null
  serviceWorkerNote: string
}

async function waitForServiceWorkerReady(ms = 8000) {
  if (!('serviceWorker' in navigator)) return false
  try {
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error('timeout')), ms)
      }),
    ])
    return true
  } catch {
    return false
  }
}

export async function getNotificationDebugSnapshot(): Promise<NotificationDebugSnapshot> {
  const settings = loadAppSettings()
  let serviceWorkerRegistered = false
  let serviceWorkerReady = false
  let serviceWorkerState = 'none'
  let serviceWorkerScript = ''
  let pushSubscriptionActive = false

  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      serviceWorkerRegistered = Boolean(reg)
      const worker = reg?.active ?? reg?.waiting ?? reg?.installing
      serviceWorkerState = worker?.state ?? (reg ? 'registered' : 'none')
      serviceWorkerScript = worker?.scriptURL ?? ''
      serviceWorkerReady = await waitForServiceWorkerReady(3000)
      if (reg) {
        const sub = await reg.pushManager.getSubscription()
        pushSubscriptionActive = Boolean(sub)
      }
    } catch {
      /* ignore */
    }
  }

  const debugMode = isDebugMode()
  const workerStatus = await fetchWorkerPushStatus()
  const workerVapidConfigured = workerStatus?.vapidConfigured ?? null

  let serviceWorkerNote = ''
  if (!isWebPushConfigured()) {
    serviceWorkerNote =
      'Add VITE_VAPID_PUBLIC_KEY + VITE_PUSH_API_BASE to .env.local, then restart Vite (dev:debug).'
  } else if (workerVapidConfigured === false) {
    serviceWorkerNote =
      'Worker has no VAPID keys. Add VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY to worker/.dev.vars (same values as wrangler secrets), restart wrangler dev.'
  } else if (!('serviceWorker' in navigator)) {
    serviceWorkerNote = 'Service workers not supported in this browser.'
  } else if (!serviceWorkerRegistered) {
    serviceWorkerNote =
      'No SW registration yet. Restart npm run dev:debug after env change; check DevTools → Application → Service Workers for errors.'
  } else if (serviceWorkerState === 'installing') {
    serviceWorkerNote =
      debugMode
        ? 'Stale worker? Tap Unregister SW, reload, then Wait for SW. Debug uses public/dev-push-sw.js (not Workbox).'
        : 'SW is installing. Wait and refresh, or Unregister SW and reload.'
  } else if (!serviceWorkerReady) {
    serviceWorkerNote = `SW state: ${serviceWorkerState}. Reload the page, or DevTools → Application → Service Workers → Unregister. Fallback: npm run build && npm run preview.`
  } else if (
    import.meta.env.VITE_PUSH_API_BASE?.trim().startsWith('https://127.0.0.1') ||
    import.meta.env.VITE_PUSH_API_BASE?.trim().startsWith('https://localhost')
  ) {
    serviceWorkerNote =
      'Tip: use http://127.0.0.1:8787 for VITE_PUSH_API_BASE (wrangler dev is HTTP, not HTTPS).'
  } else if (debugMode) {
    serviceWorkerNote = serviceWorkerScript.includes('dev-push-sw.js')
      ? 'Debug push SW ready. Sync push → /push/test with tab closed.'
      : 'Service worker ready. Use Worker /push/test with tab closed for background push.'
  }

  return {
    permission: notificationPermission(),
    enabledInApp: areNotificationsEnabled(),
    disableNotifications: settings.disableNotifications,
    webPushEnvConfigured: isWebPushConfigured(),
    pushApiBase: import.meta.env.VITE_PUSH_API_BASE?.trim() ?? '',
    vapidConfigured: Boolean(import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim()),
    serviceWorkerSupported: 'serviceWorker' in navigator,
    serviceWorkerRegistered,
    serviceWorkerReady,
    serviceWorkerState,
    serviceWorkerScript,
    pushSubscriptionActive,
    pushClientId: getPushClientId(),
    deliveryWeekday: settings.deliveryWeekday,
    deliveryTimeLocal: settings.deliveryTimeLocal,
    timezone: settings.timezone,
    debugMode,
    workerVapidConfigured,
    serviceWorkerNote,
  }
}

export async function debugRequestNotificationPermission() {
  const res = await requestNotificationsPermission()
  if (res === 'granted' && isWebPushConfigured()) {
    return syncPushSubscriptionWithResult()
  }
  return { ok: res === 'granted', status: 0, detail: `Permission: ${res}` }
}

export function debugForegroundNotification() {
  const ok = notifyPackageArrived(
    'Mentell debug',
    'Foreground notification (tab may be open).',
  )
  if (ok) return { ok: true, status: 0, detail: 'Shown via Notification API' }
  if (!('Notification' in window)) {
    return { ok: false, status: 0, detail: 'Notifications not supported' }
  }
  const settings = loadAppSettings()
  if (settings.disableNotifications) {
    return { ok: false, status: 0, detail: 'disableNotifications is on in settings' }
  }
  return { ok: false, status: 0, detail: `Permission: ${Notification.permission}` }
}

export async function debugRunPackageDeliveryNotify() {
  const created = await runPackageDeliveryAndNotify()
  return {
    ok: true,
    status: 0,
    detail:
      created.length > 0
        ? `Created ${created.length} package(s); notified if enabled`
        : 'No new packages (schedule/entries may block creation)',
  }
}

export async function debugWaitForServiceWorker() {
  const ok = await waitForServiceWorkerReady(20_000)
  return {
    ok,
    detail: ok
      ? 'Service worker is active — try Sync push (worker)'
      : 'Timed out. Use Unregister SW, reload, or check DevTools → Console for SW errors.',
  }
}

export async function debugUnregisterServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return { ok: false, detail: 'Service workers not supported' }
  }
  const regs = await navigator.serviceWorker.getRegistrations()
  if (regs.length === 0) return { ok: true, detail: 'No registrations — reload the page' }
  const results = await Promise.all(regs.map((r) => r.unregister()))
  const ok = results.every(Boolean)
  return {
    ok,
    detail: ok
      ? `Unregistered ${regs.length} worker(s). Reload — debug will use dev-push-sw.js.`
      : 'Some unregisters failed',
  }
}

export function debugScheduleDelayedForeground(seconds: number) {
  const delay = Math.min(120, Math.max(3, Math.trunc(seconds)))
  window.setTimeout(() => {
    notifyPackageArrived(
      'Mentell (delayed foreground)',
      `Fired after ${delay}s — Safari often hides these while this tab is focused.`,
    )
  }, delay * 1000)
  return {
    ok: true,
    detail: `Foreground notify in ${delay}s (keep tab open; Safari may suppress). Prefer delayed push below.`,
  }
}

export { syncPushSubscriptionWithResult, sendWorkerPushTest, sendWorkerPushTestDelayed, unsubscribePush }

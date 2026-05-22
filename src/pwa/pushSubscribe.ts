import { isDebugMode } from '../shared/debug/debugFlags'
import { getFirebaseAuth } from '../shared/firebase/firebaseApp'
import { isFirebaseEnabled } from '../shared/features/featureFlags'
import { loadAppSettings } from '../shared/settings/appSettings'
import { scopedStorageKey } from '../shared/storage/storageScope'

const PUSH_CLIENT_ID_KEY = scopedStorageKey('mentell.pushClientId')

function pushApiBase() {
  const raw = import.meta.env.VITE_PUSH_API_BASE?.trim()
  if (!raw) return ''
  let base = raw.replace(/\/$/, '')
  try {
    const u = new URL(base)
    if (
      (u.hostname === '127.0.0.1' || u.hostname === 'localhost') &&
      u.protocol === 'https:'
    ) {
      u.protocol = 'http:'
      base = u.origin
    }
  } catch {
    /* keep raw */
  }
  return base
}

export function isWebPushConfigured() {
  return Boolean(import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim() && pushApiBase())
}

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64Safe)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function getOrCreatePushClientId() {
  let id = localStorage.getItem(PUSH_CLIENT_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(PUSH_CLIENT_ID_KEY, id)
  }
  return id
}

async function authHeader(): Promise<Record<string, string>> {
  const weeklyToken = import.meta.env.VITE_WEEKLY_AI_TOKEN?.trim()
  // Debug + local worker usually has no FIREBASE_SERVICE_ACCOUNT_JSON — use shared token + clientId.
  if (isDebugMode() && weeklyToken) {
    return { Authorization: `Bearer ${weeklyToken}` }
  }
  if (isFirebaseEnabled()) {
    const auth = getFirebaseAuth()
    const user = auth?.currentUser
    if (user) {
      const idToken = await user.getIdToken()
      return { Authorization: `Bearer ${idToken}` }
    }
  }
  if (weeklyToken) return { Authorization: `Bearer ${weeklyToken}` }
  return {}
}

async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

async function ensurePushSubscription(): Promise<PushSubscription | null> {
  const vapid = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim()
  if (!vapid) return null
  const existing = await getPushSubscription()
  if (existing) return existing
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapid),
  })
}

export type PushSubscribeResult = {
  ok: boolean
  status: number
  detail: string
  skipped?: boolean
}

export async function syncPushSubscriptionWithResult(): Promise<PushSubscribeResult> {
  if (!isWebPushConfigured()) {
    return { ok: false, status: 0, detail: 'Push env not set (VITE_VAPID_PUBLIC_KEY, VITE_PUSH_API_BASE)', skipped: true }
  }
  const settings = loadAppSettings()

  if (settings.disableNotifications || Notification.permission !== 'granted') {
    await unsubscribePush()
    return {
      ok: false,
      status: 0,
      detail: settings.disableNotifications
        ? 'Notifications disabled in settings'
        : `Permission is ${Notification.permission}`,
      skipped: true,
    }
  }

  const subscription = await ensurePushSubscription()
  if (!subscription) {
    return { ok: false, status: 0, detail: 'No push subscription (service worker not ready?)' }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(await authHeader()),
  }

  const body = {
    subscription: subscription.toJSON(),
    clientId: getOrCreatePushClientId(),
    disableNotifications: settings.disableNotifications,
    deliveryWeekday: settings.deliveryWeekday,
    deliveryTimeLocal: settings.deliveryTimeLocal,
    timezone: settings.timezone,
  }

  const res = await fetch(`${pushApiBase()}/push/subscribe`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const text = await res.text().catch(() => '')
  return {
    ok: res.ok,
    status: res.status,
    detail: res.ok ? 'Subscribed' : text || res.statusText,
  }
}

export async function syncPushSubscription() {
  await syncPushSubscriptionWithResult()
}

type PushTestPayload =
  | { ok: false; detail: string }
  | {
      ok: true
      token: string
      endpoint: string
      keys: { p256dh: string; auth: string }
    }

async function pushTestPayload(): Promise<PushTestPayload> {
  const subscription = await getPushSubscription()
  if (!subscription) return { ok: false, detail: 'Subscribe first (sync push to worker)' }
  const json = subscription.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, detail: 'Subscription missing keys' }
  }
  const token = import.meta.env.VITE_WEEKLY_AI_TOKEN?.trim()
  if (!token) {
    return { ok: false, detail: 'VITE_WEEKLY_AI_TOKEN not set (needed for push test routes)' }
  }
  return {
    ok: true,
    token,
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  }
}

export async function sendWorkerPushTest(): Promise<PushSubscribeResult> {
  if (!isWebPushConfigured()) {
    return { ok: false, status: 0, detail: 'Push env not set', skipped: true }
  }
  const payload = await pushTestPayload()
  if (!payload.ok) {
    return { ok: false, status: 0, detail: payload.detail }
  }
  const res = await fetch(`${pushApiBase()}/push/test`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${payload.token}`,
    },
    body: JSON.stringify({
      endpoint: payload.endpoint,
      keys: payload.keys,
    }),
  })
  const text = await res.text().catch(() => '')
  return {
    ok: res.ok,
    status: res.status,
    detail: res.ok ? 'Test push sent — close tab to verify SW notification' : text || res.statusText,
  }
}

export async function sendWorkerPushTestDelayed(
  delaySeconds: number,
): Promise<PushSubscribeResult> {
  if (!isWebPushConfigured()) {
    return { ok: false, status: 0, detail: 'Push env not set', skipped: true }
  }
  const payload = await pushTestPayload()
  if (!payload.ok) {
    return { ok: false, status: 0, detail: payload.detail }
  }
  const delay = Math.min(120, Math.max(3, Math.trunc(delaySeconds)))
  const res = await fetch(`${pushApiBase()}/push/test-delayed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${payload.token}`,
    },
    body: JSON.stringify({
      endpoint: payload.endpoint,
      keys: payload.keys,
      delaySeconds: delay,
    }),
  })
  const text = await res.text().catch(() => '')
  let scheduled = delay
  try {
    const json = JSON.parse(text) as { scheduledInSeconds?: number }
    if (json.scheduledInSeconds) scheduled = json.scheduledInSeconds
  } catch {
    /* ignore */
  }
  let detail = res.ok
    ? `Push scheduled in ${scheduled}s — close this tab or switch away now (Safari-friendly).`
    : text || res.statusText
  if (!res.ok && text.includes('VAPID keys not configured')) {
    detail =
      'Worker missing VAPID — add VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY to worker/.dev.vars (not only wrangler secret), restart wrangler dev.'
  }
  return {
    ok: res.ok,
    status: res.status,
    detail,
  }
}

export async function fetchWorkerPushStatus(): Promise<{ vapidConfigured: boolean } | null> {
  if (!isWebPushConfigured()) return null
  try {
    const res = await fetch(`${pushApiBase()}/push/status`)
    if (!res.ok) return { vapidConfigured: false }
    return (await res.json()) as { vapidConfigured: boolean }
  } catch {
    return { vapidConfigured: false }
  }
}

export function getPushClientId() {
  return localStorage.getItem(PUSH_CLIENT_ID_KEY)
}

export async function unsubscribePush() {
  if (!isWebPushConfigured()) return
  const subscription = await getPushSubscription()
  if (!subscription) return

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(await authHeader()),
  }

  try {
    await fetch(`${pushApiBase()}/push/unsubscribe`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        clientId: getOrCreatePushClientId(),
      }),
    })
  } catch {
    /* best effort */
  }

  try {
    await subscription.unsubscribe()
  } catch {
    /* best effort */
  }
}

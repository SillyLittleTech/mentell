import {
  firestoreHasEntriesInRange,
  firestoreHasWeeklyPackage,
} from './firestoreAdmin'
import type { PushEnv } from './env'
import { GENERIC_PUSH_TIMEZONE, inDeliveryWindow, lastCompletedWeekRange } from './pushDelivery'
import { configureWebPush, sendWebPush } from './pushSend'
import type { PushSubscriber } from './pushTypes'

const SENT_TTL_SECONDS = 8 * 24 * 60 * 60

export async function runPushCron(env: PushEnv) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return
  configureWebPush(env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY)

  const now = new Date()
  let cursor: string | undefined

  do {
    const list = await env.PUSH_KV.list({ prefix: 'sub:', cursor, limit: 100 })
    for (const key of list.keys) {
      if (key.name.startsWith('sub:cid:') || key.name.startsWith('sub:')) {
        const raw = await env.PUSH_KV.get(key.name)
        if (!raw) continue
        let sub: PushSubscriber
        try {
          sub = JSON.parse(raw) as PushSubscriber
        } catch {
          continue
        }
        await maybeNotifySubscriber(env, sub, now, key.name)
      }
    }
    cursor = list.list_complete ? undefined : list.cursor
  } while (cursor)
}

async function maybeNotifySubscriber(
  env: PushEnv,
  sub: PushSubscriber,
  now: Date,
  kvKey: string,
) {
  if (sub.disableNotifications) return

  const syncUser = Boolean(sub.uid && env.FIREBASE_SERVICE_ACCOUNT_JSON)
  const tz = syncUser ? sub.timezone : GENERIC_PUSH_TIMEZONE

  if (!inDeliveryWindow(now, sub.deliveryWeekday, sub.deliveryTimeLocal, tz)) return

  const { weekKey, startKey, endKey } = lastCompletedWeekRange(now, tz)
  const dedupeKey = `sent:${sub.uid ?? sub.clientId ?? kvKey}:${weekKey}`
  if (await env.PUSH_KV.get(dedupeKey)) return

  const title = 'Mentell'
  let body = 'Your weekly reflection package may be ready — open Mentell to check.'

  if (syncUser && sub.uid && env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const hasEntries = await firestoreHasEntriesInRange(
      env.FIREBASE_SERVICE_ACCOUNT_JSON,
      sub.uid,
      startKey,
      endKey,
    )
    if (!hasEntries) return
    const hasPackage = await firestoreHasWeeklyPackage(
      env.FIREBASE_SERVICE_ACCOUNT_JSON,
      sub.uid,
      weekKey,
    )
    if (hasPackage) return
    body = `Your package for ${weekKey} is ready — tap to open your week.`
  }

  try {
    await sendWebPush(
      { endpoint: sub.endpoint, keys: sub.keys },
      { title, body },
    )
    await env.PUSH_KV.put(dedupeKey, String(Date.now()), { expirationTtl: SENT_TTL_SECONDS })
  } catch (err: unknown) {
    const status = err && typeof err === 'object' && 'statusCode' in err ? Number((err as { statusCode: number }).statusCode) : 0
    if (status === 404 || status === 410) {
      await env.PUSH_KV.delete(kvKey)
      await env.PUSH_KV.delete(`ep:${await hashEndpoint(sub.endpoint)}`)
    }
  }
}

async function hashEndpoint(endpoint: string) {
  const data = new TextEncoder().encode(endpoint)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

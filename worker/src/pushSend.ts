import { sendNotification, WebPushError } from 'web-push-neo'
import type { PushKeys } from './pushTypes'

let vapidDetails: {
  subject: string
  publicKey: string
  privateKey: string
} | null = null

export function configureWebPush(publicKey: string, privateKey: string) {
  vapidDetails = {
    subject: 'mailto:hello@sillylittle.tech',
    publicKey,
    privateKey,
  }
}

export async function sendWebPush(
  subscription: { endpoint: string; keys: PushKeys },
  payload: { title: string; body: string },
) {
  if (!vapidDetails) {
    throw new Error('VAPID not configured')
  }

  try {
    await sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      JSON.stringify(payload),
      {
        vapidDetails,
        urgency: 'high',
        TTL: 7 * 24 * 60 * 60,
        // RFC 8030 Topic can 400 on web.push.apple.com; omit it for APNs.
        ...(subscription.endpoint.includes('web.push.apple.com')
          ? {}
          : { topic: 'mentellpkg' }),
      },
    )
  } catch (err) {
    if (err instanceof WebPushError) {
      const wrapped = new Error(err.message) as Error & { statusCode?: number }
      wrapped.statusCode = err.statusCode
      throw wrapped
    }
    throw err
  }
}

/// <reference lib="webworker" />

/**
 * Push/notification listeners live in their own module so they register before
 * Workbox evaluates. Keep this file small: iOS only wakes the SW briefly for APNs.
 */
declare const self: ServiceWorkerGlobalScope

type PushPayload = {
  title?: string
  body?: string
}

function parsePushPayload(data: PushMessageData | null): PushPayload | undefined {
  if (!data) return undefined
  try {
    return data.json() as PushPayload
  } catch {
    return undefined
  }
}

function weekUrl() {
  return new URL('week', self.registration.scope).href
}

async function showPushNotification(event: PushEvent) {
  const data = parsePushPayload(event.data)
  const title = data?.title?.trim() || 'Mentell'
  const body = data?.body?.trim() || 'Your weekly package may be ready.'
  const url = weekUrl()
  // iOS/macOS Safari: extra fields (badge, huge icons) can reject the notification
  // and APNs then dumps the backlog when the PWA is next opened.
  try {
    await self.registration.showNotification(title, {
      body,
      tag: 'mentell-package',
      data: { url },
    })
  } catch {
    await self.registration.showNotification(title, { body })
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  event.waitUntil(showPushNotification(event))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const raw = event.notification.data
  const target =
    raw && typeof raw === 'object' && 'url' in raw && typeof raw.url === 'string'
      ? raw.url
      : weekUrl()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          void client.focus()
          if ('navigate' in client && typeof client.navigate === 'function') {
            return client.navigate(target)
          }
          return
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})

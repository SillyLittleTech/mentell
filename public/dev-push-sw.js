/* Minimal push-only service worker for npm run dev:debug (no Workbox precache). */
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

function parsePushPayload(data) {
  if (!data) return undefined
  try {
    return data.json()
  } catch {
    return undefined
  }
}

function weekUrl() {
  return new URL('week', self.registration.scope).href
}

async function showPushNotification(event) {
  const data = parsePushPayload(event.data)
  const title = data?.title?.trim() || 'Mentell'
  const body = data?.body?.trim() || 'Your weekly package may be ready.'
  const url = weekUrl()
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

self.addEventListener('push', (event) => {
  event.waitUntil(showPushNotification(event))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const raw = event.notification.data
  const target =
    raw && typeof raw === 'object' && typeof raw.url === 'string' ? raw.url : weekUrl()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.focus()
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

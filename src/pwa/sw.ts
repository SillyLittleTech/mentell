/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

type PushPayload = {
  title?: string
  body?: string
}

self.addEventListener('push', (event) => {
  const data = (() => {
    try {
      return event.data?.json() as PushPayload | undefined
    } catch {
      return undefined
    }
  })()
  const title = data?.title ?? 'Mentell'
  const body = data?.body ?? 'Your weekly package may be ready.'
  const scopePath = new URL(self.registration.scope).pathname
  const icon = `${scopePath}asset/mentell-icon.png`.replace(/\/{2,}/g, '/')
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      tag: 'mentell-package',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const scopePath = new URL(self.registration.scope).pathname.replace(/\/$/, '')
  const target = `${scopePath}/week`.replace(/\/{2,}/g, '/') || '/week'
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

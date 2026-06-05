/** Push-only SW for dev:debug — avoids vite-plugin-pwa dev worker stuck on precache. */
export async function registerDebugPushServiceWorker() {
  if (!('serviceWorker' in navigator)) return

  const scriptUrl = `${import.meta.env.BASE_URL}dev-push-sw.js`.replace(/\/+/g, '/')
  const scope = import.meta.env.BASE_URL || '/'

  const existing = await navigator.serviceWorker.getRegistration(scope)
  if (existing) {
    const script = existing.active?.scriptURL ?? existing.installing?.scriptURL ?? ''
    const isOurs = script.includes('dev-push-sw.js')
    const stuck = Boolean(existing.installing) && !existing.active
    if (!isOurs || stuck) {
      await existing.unregister()
    }
  }

  await navigator.serviceWorker.register(scriptUrl, {
    scope,
    type: 'classic',
    updateViaCache: 'none',
  })
}

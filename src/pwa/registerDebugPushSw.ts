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

  const reg = await navigator.serviceWorker.register(scriptUrl, {
    scope,
    type: 'classic',
    updateViaCache: 'none',
  })
  if (reg.installing) {
    await new Promise<void>((resolve) => {
      const worker = reg.installing
      if (!worker || worker.state === 'activated' || worker.state === 'redundant') {
        resolve()
        return
      }
      const done = () => {
        if (worker.state === 'activated' || worker.state === 'redundant') resolve()
      }
      worker.addEventListener('statechange', done)
      window.setTimeout(resolve, 15_000)
    })
  }
  return reg
}

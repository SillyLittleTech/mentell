import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { publicUrl } from '../../shared/publicUrl'

/** SPA fallback when static auth/deeplink.html is not served (e.g. dev server). */
export function AuthDeeplinkPage() {
  useEffect(() => {
    const href = window.location.href
    const deepLink = new URL('mentell://auth/email')
    deepLink.searchParams.set('link', href)

    const params = new URLSearchParams(window.location.search)
    for (const key of ['oobCode', 'mode', 'apiKey', 'lang', 'continueUrl', 'tenantId'] as const) {
      const value = params.get(key)
      if (value) deepLink.searchParams.set(key, value)
    }

    const target = deepLink.toString()
    const anchor = document.createElement('a')
    anchor.href = target
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }, [])

  return (
    <section className="paper mx-auto mt-12 max-w-md rounded-3xl p-6 text-center">
      <h1 className="font-paper text-2xl">Open Mentell</h1>
      <p className="ink-muted mt-3 text-sm">
        Your sign-in link is ready. Use the Mentell desktop app to finish signing in.
      </p>
      <a
        className="focus-ring mt-4 inline-block rounded-2xl border border-[var(--paper-border)] bg-[rgba(42,155,88,0.12)] px-4 py-2 text-sm font-semibold"
        href={`mentell://auth/email?link=${encodeURIComponent(window.location.href)}`}
      >
        Open Mentell app
      </a>
      <p className="ink-muted mt-4 text-xs">
        Or continue in the{' '}
        <Link to={publicUrl('settings')} className="underline">
          web app
        </Link>
        .
      </p>
    </section>
  )
}

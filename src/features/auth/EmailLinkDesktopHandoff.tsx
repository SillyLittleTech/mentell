import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { isSignInWithEmailLink } from 'firebase/auth'
import {
  buildMentellEmailDeepLink,
  currentPageHasFirebaseEmailLinkParams,
} from '../../shared/firebase/emailLinkHandoff'
import { getFirebaseAuth } from '../../shared/firebase/firebaseApp'
import { isFirebaseEnabled } from '../../shared/features/featureFlags'
import { publicUrl } from '../../shared/publicUrl'
import { isTauri } from '../../shared/platform/runtime'

/**
 * Shown in the browser when an email sign-in link lands on the web app.
 * Gives a visible handoff to the Mentell desktop app (Tauri deep link).
 */
export function EmailLinkDesktopHandoff() {
  const location = useLocation()

  const handoff = useMemo(() => {
    if (!isFirebaseEnabled() || isTauri()) return null

    const auth = getFirebaseAuth()
    const href = window.location.href
    const isEmailLink =
      (auth && isSignInWithEmailLink(auth, href)) || currentPageHasFirebaseEmailLinkParams()

    if (!isEmailLink) return null
    if (location.pathname === '/auth/deeplink') return null

    return {
      deepLink: buildMentellEmailDeepLink(href),
      settingsPath: publicUrl('settings'),
    }
  }, [location.pathname, location.search, location.hash])

  if (!handoff) return null

  return (
    <section
      className="paper fixed inset-x-3 top-3 z-[80] mx-auto max-w-lg rounded-2xl border-2 border-[var(--paper-ink)] p-4 shadow-lg sm:inset-x-auto"
      role="status"
      aria-live="polite"
    >
      <h2 className="font-paper text-lg">Finish sign-in in Mentell</h2>
      <p className="ink-muted mt-1 text-sm">
        You opened this link in a browser. To complete sign-in in the Mentell desktop app, tap the
        button below.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <a
          href={handoff.deepLink}
          className="focus-ring inline-flex items-center justify-center rounded-2xl border border-[var(--paper-ink)] bg-[var(--paper-ink)] px-4 py-2.5 text-center text-sm font-semibold text-[var(--paper-bg)]"
        >
          Open Mentell desktop app
        </a>
        <Link
          to={handoff.settingsPath}
          className="focus-ring inline-flex items-center justify-center rounded-2xl border border-[var(--paper-border)] px-4 py-2.5 text-center text-sm font-semibold"
        >
          Continue in browser instead
        </Link>
      </div>
      <p className="ink-muted mt-2 text-xs">
        Desktop app not installed? Use “Continue in browser instead”, then enter your email on
        Settings → Account.
      </p>
    </section>
  )
}

import { buildMentellEmailDeepLink } from '../../shared/firebase/emailLinkHandoff'
import { publicUrl } from '../../shared/publicUrl'

/** Hosted continue URL target — shows a clear desktop handoff before web sign-in. */
export function AuthDeeplinkPage() {
  const href = typeof window !== 'undefined' ? window.location.href : ''
  const deepLink = buildMentellEmailDeepLink(href)

  return (
    <section className="paper mx-auto mt-12 max-w-md rounded-3xl p-6 text-center">
      <h1 className="font-paper text-2xl">Open Mentell</h1>
      <p className="ink-muted mt-3 text-sm">
        Your email sign-in link is ready. Open the Mentell desktop app to finish signing in.
      </p>
      <a
        className="focus-ring mt-5 inline-flex w-full items-center justify-center rounded-2xl border border-[var(--paper-ink)] bg-[var(--paper-ink)] px-4 py-3 text-sm font-semibold text-[var(--paper-bg)]"
        href={deepLink}
      >
        Open Mentell desktop app
      </a>
      <a
        className="focus-ring mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-[var(--paper-border)] px-4 py-3 text-sm font-semibold"
        href={publicUrl('settings') + window.location.search}
      >
        Continue in browser instead
      </a>
      <p className="ink-muted mt-4 text-xs">
        If the desktop app does not open, make sure Mentell is installed, then tap the button again.
      </p>
    </section>
  )
}

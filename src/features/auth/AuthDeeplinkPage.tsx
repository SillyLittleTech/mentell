import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AccountEmailSignInForm } from '../settings/AccountEmailSignInForm'
import { useAuthOptional } from '../../shared/firebase/AuthProvider'
import {
  buildMentellEmailDeepLink,
  buildSettingsPathWithLinkParams,
  currentPageHasFirebaseEmailLinkParams,
  isOfflineEmailLinkHandoff,
} from '../../shared/firebase/emailLinkHandoff'
import { isTauri } from '../../shared/platform/runtime'

/** Hosted continue URL target — desktop handoff or browser sign-in completion. */
export function AuthDeeplinkPage() {
  const auth = useAuthOptional()
  const navigate = useNavigate()
  const href = typeof window !== 'undefined' ? window.location.href : ''
  const deepLink = buildMentellEmailDeepLink(href)
  const offlineHandoff = isOfflineEmailLinkHandoff()
  const hasEmailLink = currentPageHasFirebaseEmailLinkParams()

  useEffect(() => {
    if (!auth?.pendingEmailLinkConfirm || !hasEmailLink) return
    // Keep users on this page with the confirm form instead of losing params on a blind redirect.
  }, [auth?.pendingEmailLinkConfirm, hasEmailLink])

  if (auth?.user) {
    return (
      <section className="paper mx-auto mt-12 max-w-md rounded-3xl p-6 text-center">
        <h1 className="font-paper text-2xl">You&apos;re signed in</h1>
        <p className="ink-muted mt-3 text-sm">
          Cloud backup is connected. Open Settings to turn on sync or return to journaling.
        </p>
        <button
          type="button"
          className="focus-ring mt-5 inline-flex w-full items-center justify-center rounded-2xl border border-[var(--paper-ink)] bg-[var(--paper-ink)] px-4 py-3 text-sm font-semibold text-[var(--paper-bg)]"
          onClick={() => navigate('/settings')}
        >
          Open Settings
        </button>
      </section>
    )
  }

  return (
    <section className="paper mx-auto mt-12 max-w-md rounded-3xl p-6">
      <h1 className="font-paper text-center text-2xl">
        {offlineHandoff ? 'Finish sign-in' : 'Open Mentell'}
      </h1>
      <p className="ink-muted mt-3 text-center text-sm">
        {offlineHandoff
          ? 'Your offline copy sent you here to complete cloud sign-in in the browser.'
          : 'Your email sign-in link is ready. Open the Mentell desktop app, or finish in the browser below.'}
      </p>

      {auth?.pendingEmailLinkConfirm || hasEmailLink ? (
        <div className="mt-5">
          <AccountEmailSignInForm
            onSuccess={() => {
              navigate('/settings', { replace: true })
            }}
          />
        </div>
      ) : null}

      {!offlineHandoff && !isTauri() ? (
        <a
          className="focus-ring mt-5 inline-flex w-full items-center justify-center rounded-2xl border border-[var(--paper-ink)] bg-[var(--paper-ink)] px-4 py-3 text-sm font-semibold text-[var(--paper-bg)]"
          href={deepLink}
        >
          Open Mentell desktop app
        </a>
      ) : null}

      {!auth?.pendingEmailLinkConfirm ? (
        <a
          className="focus-ring mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-[var(--paper-border)] px-4 py-3 text-sm font-semibold"
          href={buildSettingsPathWithLinkParams()}
        >
          Continue on Settings page
        </a>
      ) : null}

      {offlineHandoff ? (
        <p className="ink-muted mt-4 text-center text-xs">
          After sign-in, use the hosted Mentell app or desktop app for cloud sync. The offline ZIP
          file keeps its own local journal copy.
        </p>
      ) : (
        <p className="ink-muted mt-4 text-center text-xs">
          If the desktop app does not open, use the browser sign-in form above or Settings →
          Account.
        </p>
      )}
    </section>
  )
}

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { scrollToElementId, scrollToTop } from '../../shared/motion/scroll'
import { ContactForQuestions } from './contactEmails'
import {
  isFirebaseEnabled,
  isFirebaseSyncEnabled,
  isShareLinksEnabled,
} from '../../shared/features/featureFlags'

const SILLY_LITTLE_POLICY_URL = 'https://sillylittle.tech/policy'

export function PrivacyPolicyPage() {
  const { pathname, hash } = useLocation()
  const firebaseOn = isFirebaseEnabled()
  const syncOn = isFirebaseSyncEnabled()
  const shareOn = isShareLinksEnabled()
  const weeklyAiOn = import.meta.env.VITE_ENABLE_WEEKLY_AI_SUMMARY === '1'

  useEffect(() => {
    if (hash) {
      scrollToElementId(hash)
      return
    }
    scrollToTop()
  }, [pathname, hash])

  return (
    <div className="space-y-4">
      <section className="paper rounded-3xl p-6">
        <div className="font-paper text-2xl">Privacy</div>
        <p className="ink-muted mt-2 text-sm leading-relaxed">
          Mentell is a personal journaling app by{' '}
          <a
            href="https://sillylittle.tech"
            className="font-medium text-[var(--success)] underline-offset-2 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            SillyLittleTech
          </a>
          . This page describes how <em>this app</em> handles data. For SillyLittleTech’s general
          site practices, see the{' '}
          <a
            href={SILLY_LITTLE_POLICY_URL}
            className="underline-offset-2 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            SillyLittleTech Privacy Policy
          </a>
          .
        </p>
        <p className="ink-muted mt-3 text-sm leading-relaxed">
          For Mentell-specific questions (policy, technical help, or security), see{' '}
          <a href="#questions" className="underline-offset-2 hover:underline">
            For questions
          </a>{' '}
          below.
        </p>
      </section>

      <section className="paper rounded-3xl p-6">
        <h2 className="font-paper text-xl">Who this app is for</h2>
        <p className="ink-muted mt-3 text-sm leading-relaxed">
          Mentell is designed for <strong>individuals</strong> who sign up and use the journal for
          themselves. It is <strong>not</strong> a HIPAA-compliant clinical record system and is{' '}
          <strong>not</strong> intended for healthcare providers, therapists, schools, or other
          organizations to collect or manage health information on behalf of patients, clients, or
          students.
        </p>
        <p className="ink-muted mt-3 text-sm leading-relaxed">
          If you are in crisis or need professional care, Mentell is not a substitute for emergency
          services or licensed treatment. Use appropriate local emergency and mental-health
          resources.
        </p>
      </section>

      <section className="paper rounded-3xl p-6">
        <h2 className="font-paper text-xl">Local-first by default</h2>
        <p className="ink-muted mt-3 text-sm leading-relaxed">
          Your journal entries, notes, score, character look, and most settings are stored on your
          device (IndexedDB and browser storage). They are not sent to a server unless you turn on
          optional cloud features below.
        </p>
      </section>

      {firebaseOn ? (
        <section className="paper rounded-3xl p-6">
          <h2 className="font-paper text-xl">Firebase Authentication &amp; cloud backup (optional)</h2>
          <p className="ink-muted mt-3 text-sm leading-relaxed">
            If cloud sync is enabled in your build, you may sign in with Google, email and password,
            or a passwordless email link. Authentication is provided by{' '}
            <strong>Firebase Authentication</strong> (Google). We receive an account identifier and,
            depending on how you sign in, your email address and display information from your
            identity provider.
          </p>
          {syncOn ? (
            <p className="ink-muted mt-3 text-sm leading-relaxed">
              With sync turned on, journal data and related settings you choose to back up are stored
              in <strong>Cloud Firestore</strong> under your account, keyed to your Firebase user id.
              This includes character customization and shop cosmetics you unlock/equip. You can sign
              out, disable sync, delete local data, or delete your cloud account from Settings. Cloud
              data is not intended for provider-managed or multi-patient use.
            </p>
          ) : (
            <p className="ink-muted mt-3 text-sm leading-relaxed">
              Sign-in may be available without sync in some builds; check Settings for what is
              enabled.
            </p>
          )}
          {shareOn ? (
            <p className="ink-muted mt-3 text-sm leading-relaxed">
              Share links (if enabled) store a time-limited, sanitized snapshot of selected journal
              content in Firestore for viewers who have the link. Treat share URLs like passwords.
            </p>
          ) : null}
          <p className="ink-muted mt-3 text-sm leading-relaxed">
            See Google’s{' '}
            <a
              href="https://firebase.google.com/support/privacy"
              className="underline-offset-2 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Firebase Privacy information
            </a>{' '}
            for how Google processes data as a provider.
          </p>
        </section>
      ) : (
        <section className="paper rounded-3xl p-6">
          <h2 className="font-paper text-xl">Cloud sign-in (not enabled in this build)</h2>
          <p className="ink-muted mt-3 text-sm leading-relaxed">
            This deployment does not load Firebase. Journal data stays on your device only.
          </p>
        </section>
      )}

      {weeklyAiOn ? (
        <section className="paper rounded-3xl p-6">
          <h2 className="font-paper text-xl">Weekly AI summaries (optional)</h2>
          <p className="ink-muted mt-3 text-sm leading-relaxed">
            If weekly AI is enabled, generating a summary sends a bounded excerpt of your journal
            (and optional profile fields you enter in AI preferences) to a{' '}
            <strong>Cloudflare Worker</strong> using <strong>Workers AI</strong>. The request is
            authenticated with a site token; it is not tied to your Firebase account unless you have
            also enabled cloud sync separately.
          </p>
          <p className="ink-muted mt-3 text-sm leading-relaxed">
            Do not include information in summaries you would not want processed by an AI service.
            See Cloudflare’s privacy documentation for how they handle inference requests.
          </p>
        </section>
      ) : (
        <section className="paper rounded-3xl p-6">
          <h2 className="font-paper text-xl">Weekly AI summaries (not enabled)</h2>
          <p className="ink-muted mt-3 text-sm leading-relaxed">
            This build does not call Cloudflare Workers AI for weekly summaries.
          </p>
        </section>
      )}

      <section className="paper rounded-3xl p-6">
        <h2 className="font-paper text-xl">Hosting</h2>
        <p className="ink-muted mt-3 text-sm leading-relaxed">
          The static app is served from GitHub Pages. Optional Firebase Hosting may serve a small
          landing page on the auth domain. Standard request metadata (IP, user agent, URLs) may be
          logged by those hosts for reliability and security.
        </p>
      </section>

      <section id="questions" className="paper scroll-mt-6 rounded-3xl p-6">
        <h2 className="font-paper text-xl">For questions</h2>
        <p className="ink-muted mt-2 text-sm leading-relaxed">
          Reach the Mentell team directly:
        </p>
        <ContactForQuestions />
      </section>

      <section className="paper rounded-3xl p-6">
        <h2 className="font-paper text-xl">SillyLittleTech site policy</h2>
        <p className="ink-muted mt-3 text-sm leading-relaxed">
          Broader practices for the SillyLittleTech lander and organization (contact forms, hosting,
          analytics) are in the{' '}
          <a
            href={SILLY_LITTLE_POLICY_URL}
            className="underline-offset-2 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            SillyLittleTech Privacy Policy
          </a>
          .
        </p>
      </section>
    </div>
  )
}

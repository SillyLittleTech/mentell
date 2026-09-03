import { useEffect, useState } from 'react'
import {
  debugFirebaseConfigSummary,
  debugParseEmailLink,
  debugProbeCreateAuthUri,
  debugStopAuthCallbackServer,
  debugTestAuthCallbackServer,
  debugWaitForAuthCallbackOnce,
  getAuthDebugSnapshot,
  type AuthDebugSnapshot,
} from './debugAuth'
import { buildMentellEmailDeepLink } from '../../shared/firebase/emailLinkHandoff'
import { isTauri } from '../../shared/platform/runtime'
import { openUrl } from '@tauri-apps/plugin-opener'

export function DebugAuthSection() {
  const [snap, setSnap] = useState<AuthDebugSnapshot>(() => getAuthDebugSnapshot())
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [callbackPort, setCallbackPort] = useState<number | null>(null)
  const [testLink, setTestLink] = useState(
    'https://projects.slt.ong/mentell/auth/deeplink?oobCode=TEST&mode=signIn&apiKey=test',
  )

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSnap(getAuthDebugSnapshot())
  }, [])

  async function run(label: string, fn: () => Promise<string>) {
    setBusy(true)
    setResult(`${label}: running…`)
    try {
      const message = await fn()
      setResult(`${label}: ${message}`)
      setSnap(getAuthDebugSnapshot())
    } catch (error) {
      setResult(`${label}: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const deepLink = buildMentellEmailDeepLink(testLink)

  return (
    <section className="rounded-2xl border border-[var(--paper-border)] p-4">
      <div className="font-mono text-xs font-bold uppercase tracking-wide text-[var(--ink)]">
        Auth / deep link
      </div>
      <p className="ink-muted mt-1 text-xs">
        Diagnose desktop sign-in, localhost callbacks, and mentell:// handoff URLs. Use{' '}
        <code className="font-mono">npm run tauri dev</code> (not dev:debug) for real Firebase
        sign-in testing.
      </p>

      <dl className="mt-3 grid gap-1 font-mono text-[10px] leading-snug">
        <div>
          <dt className="inline text-[var(--ink-muted)]">tauri </dt>
          <dd className="inline">{String(snap.isTauri)} (api={String(snap.apiIsTauri)})</dd>
        </div>
        <div>
          <dt className="inline text-[var(--ink-muted)]">firebase </dt>
          <dd className="inline">
            {String(snap.firebaseEnabled)} debugProvider={String(snap.usesDebugAuthProvider)}
          </dd>
        </div>
        <div>
          <dt className="inline text-[var(--ink-muted)]">origin </dt>
          <dd className="inline break-all">{snap.origin || snap.protocol || 'n/a'}</dd>
        </div>
        <div>
          <dt className="inline text-[var(--ink-muted)]">continue </dt>
          <dd className="inline break-all">{snap.webContinueUrl}</dd>
        </div>
        <div>
          <dt className="inline text-[var(--ink-muted)]">hosted </dt>
          <dd className="inline break-all">{snap.hostedContinueUrl}</dd>
        </div>
        <div>
          <dt className="inline text-[var(--ink-muted)]">config </dt>
          <dd className="inline break-all">{debugFirebaseConfigSummary()}</dd>
        </div>
      </dl>

      <label className="mt-3 grid gap-1 text-xs">
        <span className="ink-muted font-medium">Test email-link URL</span>
        <textarea
          className="focus-ring min-h-[4rem] rounded-xl border border-[var(--paper-border)] bg-transparent px-3 py-2 font-mono text-[10px]"
          value={testLink}
          onChange={(e) => setTestLink(e.target.value)}
        />
      </label>

      <div className="mt-2 break-all font-mono text-[10px] text-[var(--ink)]">
        <div className="ink-muted text-[9px] uppercase">mentell:// handoff</div>
        {deepLink}
      </div>
      <p className="ink-muted mt-1 text-[10px]">{debugParseEmailLink(testLink)}</p>

      <div className="mt-3 grid gap-2">
        <button
          type="button"
          disabled={busy || !isTauri()}
          className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
          onClick={() =>
            void run('start callback', async () => {
              const message = await debugTestAuthCallbackServer()
              const port = Number(message.match(/:(\d+)/)?.[1] ?? 0)
              if (port) setCallbackPort(port)
              return message
            })
          }
        >
          Start localhost callback server (Tauri)
        </button>
        <button
          type="button"
          disabled={busy || !isTauri() || !callbackPort}
          className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
          onClick={() =>
            void run('probe createAuthUri', () => debugProbeCreateAuthUri(callbackPort!))
          }
        >
          Probe Firebase createAuthUri
        </button>
        <button
          type="button"
          disabled={busy || !isTauri() || !callbackPort}
          className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
          onClick={() =>
            void run('wait callback', () => debugWaitForAuthCallbackOnce(callbackPort!))
          }
        >
          Wait for callback (open browser link while this runs)
        </button>
        <button
          type="button"
          disabled={busy || !isTauri()}
          className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
          onClick={() => void run('stop callback', debugStopAuthCallbackServer)}
        >
          Stop callback server
        </button>
        <button
          type="button"
          disabled={busy}
          className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(deepLink)
              setResult('Copied mentell:// handoff URL to clipboard')
            } catch {
              setResult('Could not copy to clipboard')
            }
          }}
        >
          Copy mentell:// handoff URL
        </button>
        {isTauri() ? (
          <a
            href={deepLink}
            className="focus-ring rounded-2xl border border-[var(--paper-ink)] bg-[var(--paper-ink)] px-3 py-2 text-center text-sm font-semibold text-[var(--paper-bg)]"
            onClick={(event) => {
              event.preventDefault()
              void openUrl(deepLink).catch((error) => {
                setResult(`openUrl failed: ${error instanceof Error ? error.message : String(error)}`)
              })
            }}
          >
            Open test deep link in OS
          </a>
        ) : null}
      </div>

      {result ? (
        <p className="mt-2 break-words font-mono text-[10px] leading-snug text-[var(--ink)]">
          {result}
        </p>
      ) : null}
    </section>
  )
}

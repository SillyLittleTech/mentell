import { useEffect, useRef, useState } from 'react'

type TurnstileStatus = 'loading' | 'ready' | 'solved' | 'error'

type TurnstileRenderOptions = {
  sitekey: string
  theme?: 'auto' | 'light' | 'dark'
  size?: 'normal' | 'compact' | 'flexible'
  callback?: (token: string) => void
  'error-callback'?: () => void
  'expired-callback'?: () => void
}

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string | number
  reset: (widgetId?: string | number) => void
  remove?: (widgetId?: string | number) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

let turnstileScriptPromise: Promise<void> | null = null

function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve()
  if (!turnstileScriptPromise) {
    turnstileScriptPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[data-feedback-turnstile="true"]',
      )
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(), { once: true })
        existingScript.addEventListener('error', () => reject(new Error('Failed to load Turnstile.')), {
          once: true,
        })
        return
      }

      const script = document.createElement('script')
      script.src = TURNSTILE_SCRIPT_SRC
      script.async = true
      script.defer = true
      script.dataset.feedbackTurnstile = 'true'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load Turnstile.'))
      document.head.appendChild(script)
    })
  }

  return turnstileScriptPromise
}

export function FeedbackTurnstile({
  siteKey,
  onTokenChange,
}: {
  siteKey: string
  onTokenChange: (token: string) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | number | null>(null)
  const onTokenChangeRef = useRef(onTokenChange)
  const [status, setStatus] = useState<TurnstileStatus>(() => (siteKey ? 'loading' : 'error'))
  const [message, setMessage] = useState(() =>
    siteKey
      ? 'Loading Cloudflare verification...'
      : 'Cloudflare verification is not configured for this build.',
  )

  useEffect(() => {
    onTokenChangeRef.current = onTokenChange
  }, [onTokenChange])

  useEffect(() => {
    let active = true
    const container = containerRef.current

    widgetIdRef.current = null
    onTokenChangeRef.current('')

    if (!siteKey) return () => {}

    if (!container) return () => {}

    void loadTurnstileScript()
      .then(() => {
        if (!active || !container.isConnected || !window.turnstile) return

        container.innerHTML = ''
        widgetIdRef.current = window.turnstile.render(container, {
          sitekey: siteKey,
          theme: 'auto',
          size: 'normal',
          callback: (token: string) => {
            if (!active) return
            setStatus('solved')
            setMessage('Verification complete.')
            onTokenChangeRef.current(token)
          },
          'error-callback': () => {
            if (!active) return
            setStatus('error')
            setMessage('Verification failed. Try again.')
            onTokenChangeRef.current('')
          },
          'expired-callback': () => {
            if (!active) return
            setStatus('ready')
            setMessage('Verification expired. Please solve it again.')
            onTokenChangeRef.current('')
            if (widgetIdRef.current !== null) {
              window.turnstile?.reset(widgetIdRef.current)
            }
          },
        })
        setStatus('ready')
        setMessage('Complete the check to unlock submission.')
      })
      .catch(() => {
        if (!active) return
        setStatus('error')
        setMessage('Could not load Cloudflare verification. Check your network or content blockers.')
      })

    return () => {
      active = false
      onTokenChangeRef.current('')
      if (widgetIdRef.current !== null && window.turnstile?.remove) {
        try {
          window.turnstile.remove(widgetIdRef.current)
        } catch {
          /* best effort */
        }
      }
      if (container) container.innerHTML = ''
    }
  }, [siteKey])

  return (
    <section className="rounded-2xl border border-[var(--paper-border)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Cloudflare verification</div>
          <div className="ink-muted mt-1 text-xs leading-relaxed">
            Required before submitting this form.
          </div>
        </div>
        <div className="ink-muted text-xs font-medium uppercase tracking-wide">
          {status === 'solved' ? 'Verified' : status === 'error' ? 'Needs attention' : 'Pending'}
        </div>
      </div>

      <div ref={containerRef} className="mt-4 overflow-hidden" />

      <div
        className={`mt-3 text-xs leading-relaxed ${
          status === 'error' ? 'text-[var(--danger)]' : 'ink-muted'
        }`}
        aria-live="polite"
      >
        {message}
      </div>
    </section>
  )
}

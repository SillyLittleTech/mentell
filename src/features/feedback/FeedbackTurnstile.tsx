import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

type TurnstileStatus = 'loading' | 'ready' | 'solved' | 'error'

type TurnstileRenderOptions = {
  sitekey: string
  theme?: 'auto' | 'light' | 'dark'
  size?: 'normal' | 'compact' | 'flexible'
  retry?: 'auto' | 'never'
  callback?: (token: string) => void
  'error-callback'?: (errorCode?: number | string) => void
  'expired-callback'?: () => void
  'timeout-callback'?: () => void
}

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string | number
  getResponse: (widgetId?: string | number) => string
  reset: (widgetId?: string | number) => void
  remove?: (widgetId?: string | number) => void
}

export type FeedbackTurnstileHandle = {
  getResponse: () => string
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

export const FeedbackTurnstile = forwardRef<
  FeedbackTurnstileHandle,
  {
    siteKey: string
    onTokenChange: (token: string) => void
  }
>(function FeedbackTurnstile({ siteKey, onTokenChange }, ref) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | number | null>(null)
  const onTokenChangeRef = useRef(onTokenChange)
  const retryTimerRef = useRef<number | null>(null)
  const retryCountRef = useRef(0)
  const [status, setStatus] = useState<TurnstileStatus>(() => (siteKey ? 'loading' : 'error'))
  const [message, setMessage] = useState(() =>
    siteKey
      ? 'Loading Cloudflare verification...'
      : 'Cloudflare verification is not configured for this build.',
  )

  useEffect(() => {
    onTokenChangeRef.current = onTokenChange
  }, [onTokenChange])

  useImperativeHandle(
    ref,
    () => ({
      getResponse: () => {
        if (!window.turnstile || widgetIdRef.current === null) return ''

        try {
          return window.turnstile.getResponse(widgetIdRef.current).trim()
        } catch {
          return ''
        }
      },
    }),
    [],
  )

  const clearRetryTimer = () => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
  }

  const resetWidget = (nextMessage: string) => {
    clearRetryTimer()
    retryCountRef.current = 0
    onTokenChangeRef.current('')

    if (!window.turnstile || widgetIdRef.current === null) {
      setStatus('error')
      setMessage(nextMessage)
      return
    }

    setStatus('loading')
    setMessage(nextMessage)
    try {
      window.turnstile.reset(widgetIdRef.current)
    } catch {
      setStatus('error')
      setMessage('Could not restart Cloudflare verification. Please refresh the page.')
    }
  }

  useEffect(() => {
    let active = true
    const container = containerRef.current

    widgetIdRef.current = null
    clearRetryTimer()
    retryCountRef.current = 0
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
          retry: 'auto',
          callback: (token: string) => {
            if (!active) return
            clearRetryTimer()
            retryCountRef.current = 0
            setStatus('solved')
            setMessage('Verification complete.')
            onTokenChangeRef.current(token)
          },
          'error-callback': (errorCode?: number | string) => {
            if (!active) return
            const normalizedCode = normalizeTurnstileErrorCode(errorCode)

            if (isTurnstileConfigError(normalizedCode)) {
              clearRetryTimer()
              retryCountRef.current = 0
              setStatus('error')
              setMessage(getTurnstileConfigMessage(normalizedCode))
              onTokenChangeRef.current('')
              return
            }

            if (normalizedCode === 110600 || normalizedCode === 110620) {
              clearRetryTimer()
              retryCountRef.current = 0
              setStatus('error')
              setMessage(getTurnstileTimeoutMessage(normalizedCode))
              onTokenChangeRef.current('')
              return
            }

            if (retryCountRef.current < 1) {
              retryCountRef.current += 1
              setStatus('loading')
              setMessage('Verification hit a temporary error. Retrying...')
              clearRetryTimer()
              retryTimerRef.current = window.setTimeout(() => {
                if (!active || widgetIdRef.current === null || !window.turnstile) return
                try {
                  window.turnstile.reset(widgetIdRef.current)
                } catch {
                  setStatus('error')
                  setMessage('Verification could not restart. Please refresh the page.')
                }
              }, 750)
              return
            }

            clearRetryTimer()
            retryCountRef.current = 0
            setStatus('error')
            setMessage(getTurnstileRetryMessage(normalizedCode))
            onTokenChangeRef.current('')
          },
          'expired-callback': () => {
            if (!active) return
            clearRetryTimer()
            retryCountRef.current = 0
            setStatus('ready')
            setMessage('Verification expired. Please solve it again.')
            onTokenChangeRef.current('')
            if (widgetIdRef.current !== null) {
              window.turnstile?.reset(widgetIdRef.current)
            }
          },
          'timeout-callback': () => {
            if (!active) return
            clearRetryTimer()
            retryCountRef.current = 0
            setStatus('ready')
            setMessage('Verification timed out. Please solve it again.')
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
      clearRetryTimer()
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

      {siteKey && status === 'error' ? (
        <button
          type="button"
          className="focus-ring mt-3 rounded-xl border border-[var(--paper-border)] px-3 py-2 text-xs font-semibold"
          onClick={() => resetWidget('Retrying Cloudflare verification...')}
        >
          Try again
        </button>
      ) : null}
    </section>
  )
})

function normalizeTurnstileErrorCode(errorCode?: number | string) {
  if (typeof errorCode === 'number' && Number.isFinite(errorCode)) return errorCode
  if (typeof errorCode === 'string') {
    const normalized = Number.parseInt(errorCode, 10)
    return Number.isFinite(normalized) ? normalized : undefined
  }
  return undefined
}

function getTurnstileConfigMessage(errorCode?: number) {
  switch (errorCode) {
    case 110100:
    case 110110:
    case 400020:
    case 400070:
      return 'Cloudflare verification is misconfigured for this site key.'
    case 110200:
      return 'This hostname is not authorized for the configured site key.'
    default:
      return 'Cloudflare verification is misconfigured. Please check the site key and host settings.'
  }
}

function isTurnstileConfigError(errorCode?: number) {
  switch (errorCode) {
    case 110100:
    case 110110:
    case 110200:
    case 400020:
    case 400070:
      return true
    default:
      return false
  }
}

function getTurnstileTimeoutMessage(errorCode?: number) {
  switch (errorCode) {
    case 110600:
      return 'Verification timed out. Please solve it again.'
    case 110620:
      return 'Interaction timed out. Please try again.'
    default:
      return 'Verification expired. Please solve it again.'
  }
}

function getTurnstileRetryMessage(errorCode?: number) {
  const family = getTurnstileErrorFamily(errorCode)
  if (family === 300 || family === 600) {
    return 'Verification failed. Turnstile likely blocked the request. Disable ad blockers, VPNs, or strict privacy settings and try again.'
  }

  switch (errorCode) {
    case 200100:
      return 'Verification could not load. Check your connection or content blockers.'
    case 200500:
      return 'The verification iframe could not load. Check your network or content blockers.'
    case 110600:
      return 'Verification timed out. Please solve it again.'
    case 110620:
      return 'Interaction timed out. Please try again.'
    default:
      return 'Verification failed. Check extensions, VPNs, or browser privacy settings, then try again.'
  }
}

function getTurnstileErrorFamily(errorCode?: number) {
  if (typeof errorCode !== 'number' || !Number.isFinite(errorCode)) return undefined
  return Math.floor(errorCode / 1000)
}

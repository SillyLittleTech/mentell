import { useState } from 'react'
import { useAppSettings } from '../../shared/settings/useAppSettings'
import { getFirebaseAuth } from '../../shared/firebase/firebaseApp'
import { isFirebaseEnabled } from '../../shared/features/featureFlags'
import { getOrCreatePushClientId, getWorkerApiBase, getWorkerAuthHeaders } from '../../pwa/pushSubscribe'
import { getFirestore, doc, setDoc } from 'firebase/firestore'
import { getEffectiveGlobalName } from '../../shared/settings/effectiveGlobalName'

async function readJsonResponse(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text().catch(() => '')
  if (!text) return {}
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return { error: text }
  }
}

export function SettingsEmailSection() {
  const { settings, updateSettings } = useAppSettings()
  const [emailDraft, setEmailDraft] = useState(settings.notificationEmail)
  const [subscribing, setSubscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Auto-fill from Firebase if available and local is empty
  useState(() => {
    if (!settings.notificationEmail && isFirebaseEnabled()) {
      const auth = getFirebaseAuth()
      if (auth?.currentUser?.email) {
        setEmailDraft(auth.currentUser.email)
        // We do not auto-save here, let the user click "Save & Subscribe"
      }
    }
  })

  async function handleSubscribe() {
    setError(null)
    setSuccess(false)
    setSubscribing(true)

    try {
      const apiBase = getWorkerApiBase()
      if (!apiBase) {
        throw new Error('Email API is not configured (VITE_PUSH_API_BASE)')
      }

      const authHeaders = await getWorkerAuthHeaders()
      if (!authHeaders.Authorization) {
        throw new Error('Missing API token. Set VITE_WEEKLY_AI_TOKEN or sign in, then try again.')
      }

      const res = await fetch(`${apiBase}/email/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          email: emailDraft.trim(),
          clientId: getOrCreatePushClientId(),
          dailyReminderEnabled: settings.dailyEmailReminderEnabled,
          dailyReminderHours: settings.dailyEmailReminderHours,
          weeklyPackageDropEnabled: settings.weeklyEmailEnabled,
          timezone: settings.timezone,
          globalName:
            getEffectiveGlobalName() ||
            getFirebaseAuth()?.currentUser?.displayName?.trim() ||
            '',
          disableAi: settings.disableAi,
        })
      })

      const data = await readJsonResponse(res)
      const errorText = typeof data.error === 'string' ? data.error : undefined
      const emailError = typeof data.emailError === 'string' ? data.emailError : undefined
      if (!res.ok) {
        throw new Error(errorText || emailError || `${res.status} ${res.statusText || 'No Content'}`)
      }

      updateSettings({
        notificationEmail: emailDraft.trim(),
        emailVerified: Boolean(data.verified),
      })

      if (isFirebaseEnabled()) {
        const auth = getFirebaseAuth()
        if (auth?.currentUser) {
           const db = getFirestore()
           await setDoc(doc(db, 'users', auth.currentUser.uid, 'meta', 'settings'), { emailNotification: { email: emailDraft.trim(), verified: Boolean(data.verified) } }, { merge: true }).catch(() => {})
        }
      }

      if (emailError) {
        setError(`Saved, but the verification email failed: ${emailError}`)
      } else {
        setSuccess(true)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred')
    } finally {
      setSubscribing(false)
    }
  }

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailDraft)
  // To properly sync settings changes automatically:
  const updateAndSync = (patch: Partial<typeof settings>) => {
    updateSettings(patch)
    // We should trigger a debounced or immediate sync here, but for simplicity we rely on the save button
  }

  return (
    <div className="grid gap-3 rounded-2xl border border-[var(--paper-border)] p-4 mt-4">
      <div className="text-sm font-medium">Email Notifications</div>

      <label className="grid gap-1 text-sm">
        <span className="ink-muted text-xs font-medium">Email Address</span>
        <input
          type="email"
          className="focus-ring rounded-2xl border border-[var(--paper-border)] bg-transparent px-3 py-2"
          placeholder="your@email.com"
          value={emailDraft}
          onChange={e => setEmailDraft(e.target.value)}
        />
      </label>

      {settings.notificationEmail && (
        <div className="text-xs">
          Status: {settings.emailVerified ? (
            <span className="text-green-600 font-medium">Verified</span>
          ) : (
            <span className="text-yellow-600 font-medium">Pending Verification (check your inbox)</span>
          )}
        </div>
      )}

      <label className="flex items-center justify-between gap-3 text-sm mt-2">
        <span>
          Daily Adherence Reminder
          <div className="ink-muted text-xs">Reminds you to write if you haven't yet today.</div>
        </span>
        <input
          type="checkbox"
          checked={settings.dailyEmailReminderEnabled}
          onChange={(e) => updateAndSync({ dailyEmailReminderEnabled: e.target.checked })}
        />
      </label>

      {settings.dailyEmailReminderEnabled && (
        <label className="grid gap-1 text-sm ml-4">
          <span className="ink-muted text-xs font-medium">Hours before midnight to remind</span>
          <select
            className="focus-ring rounded-2xl border border-[var(--paper-border)] bg-transparent px-3 py-2"
            value={settings.dailyEmailReminderHours}
            onChange={(e) => updateAndSync({ dailyEmailReminderHours: Number(e.target.value) })}
          >
            <option value={1}>1 hour (11:00 PM)</option>
            <option value={2}>2 hours (10:00 PM)</option>
            <option value={3}>3 hours (9:00 PM)</option>
            <option value={4}>4 hours (8:00 PM)</option>
          </select>
        </label>
      )}

      <label className="flex items-center justify-between gap-3 text-sm">
        <span>
          Weekly Package Drop Email
          <div className="ink-muted text-xs">Sends an email summary when your weekly package is ready.</div>
        </span>
        <input
          type="checkbox"
          checked={settings.weeklyEmailEnabled}
          onChange={(e) => updateAndSync({ weeklyEmailEnabled: e.target.checked })}
        />
      </label>

      {error && <div className="text-sm text-[var(--danger)]">{error}</div>}
      {success && <div className="text-sm text-green-600">Preferences updated!</div>}

      <button
        type="button"
        disabled={!isEmailValid || subscribing}
        onClick={handleSubscribe}
        className="focus-ring mt-2 rounded-2xl border border-[var(--paper-border)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
      >
        {subscribing ? 'Saving...' : 'Save & Subscribe'}
      </button>
    </div>
  )
}

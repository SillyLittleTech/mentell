import { useState } from 'react'
import { useAppSettings } from '../../shared/settings/useAppSettings'
import { getFirebaseAuth } from '../../shared/firebase/firebaseApp'
import { isFirebaseEnabled } from '../../shared/features/featureFlags'
import { getPushClientId } from '../../pwa/pushSubscribe'

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
      let token = ''
      if (isFirebaseEnabled()) {
        const auth = getFirebaseAuth()
        if (auth?.currentUser) {
          token = await auth.currentUser.getIdToken()
        }
      }

      const res = await fetch(import.meta.env.VITE_PUSH_API_BASE + '/email/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          email: emailDraft,
          clientId: getPushClientId(),
          dailyReminderEnabled: settings.dailyEmailReminderEnabled,
          dailyReminderHours: settings.dailyEmailReminderHours,
          weeklyPackageDropEnabled: settings.weeklyEmailEnabled,
          timezone: settings.timezone,
          globalName: settings.globalName,
          disableAi: settings.disableAi,
          autoVerify: isFirebaseEnabled() && getFirebaseAuth()?.currentUser?.email === emailDraft
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to subscribe')
      }

      updateSettings({
        notificationEmail: emailDraft,
        emailVerified: data.verified
      })

      setSuccess(true)
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

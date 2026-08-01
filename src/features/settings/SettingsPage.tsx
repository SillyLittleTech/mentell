import { useEffect, useMemo, useRef, useState } from 'react'
import { loadAiProfile } from '../compilation/aiProfile'
import { useAppSettings } from '../../shared/settings/useAppSettings'
import { notificationPermission, maybeRequestNotificationPermission, notificationPermissionDeniedHint } from '../../pwa/notifications'
import { isWebPushConfigured, syncPushSubscription, unsubscribePush } from '../../pwa/pushSubscribe'
import { browserTimezone } from '../../shared/settings/appSettings'
import { AccountSyncSection } from './AccountSyncSection'
import { SettingsAccountFeatures } from './SettingsAccountFeatures'
import { SettingsDebugCloudSection } from './SettingsDebugCloudSection'
import { DeskCharacterLayout } from '../character/DeskCharacterLayout'
import { pushLocalChangesNow } from '../../shared/sync/syncService'
import { isAuthDebugPanelEnabled } from '../../shared/features/featureFlags'
import { isDebugMode } from '../../shared/debug/debugFlags'
import { DebugAuthSection } from '../debug/DebugAuthSection'

const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

export function SettingsPage() {
  const { settings, updateSettings } = useAppSettings()
  const [nameDraftOverride, setNameDraftOverride] = useState<string | null>(null)
  const settingsDirtyRef = useRef(false)
  const perm = notificationPermission()

  const updateSettingsAndMarkDirty: typeof updateSettings = (patch) => {
    const next = updateSettings(patch)
    if (JSON.stringify(next) !== JSON.stringify(settings)) {
      settingsDirtyRef.current = true
    }
    return next
  }

  useEffect(() => {
    void maybeRequestNotificationPermission()
  }, [])

  useEffect(() => {
    return () => {
      if (settingsDirtyRef.current) void pushLocalChangesNow()
    }
  }, [])

  useEffect(() => {
    if (!settings.disableNotifications && isWebPushConfigured()) {
      void syncPushSubscription()
    }
  }, [
    settings.disableNotifications,
    settings.deliveryWeekday,
    settings.deliveryTimeLocal,
    settings.timezone,
  ])

  const nameDraft = nameDraftOverride ?? settings.globalName

  const aiNameFallback = useMemo(() => {
    if (settings.globalNameManuallySet || settings.globalName.trim()) return ''
    return loadAiProfile().displayName.trim()
  }, [settings.globalName, settings.globalNameManuallySet])

  return (
    <DeskCharacterLayout>
    <div className="space-y-4">
      <section className="paper rounded-3xl p-6">
        <div className="font-paper text-2xl">Settings</div>
        <div className="ink-muted mt-1 text-sm">
          Stored only on this device. Changes apply immediately.
        </div>
      </section>

      <section className="paper rounded-3xl p-6">
        <div className="font-paper text-xl">Accessibility</div>
        <label className="mt-4 flex items-center justify-between gap-3 text-sm">
          <span>
            Reduced motion
            <div className="ink-muted text-xs">Minimizes animations; also respects OS preference.</div>
          </span>
          <input
            type="checkbox"
            checked={settings.reducedMotion}
            onChange={(e) => updateSettingsAndMarkDirty({ reducedMotion: e.target.checked })}
          />
        </label>
      </section>

      <section className="paper rounded-3xl p-6">
        <div className="font-paper text-xl">Features</div>
        <div className="mt-4 grid gap-4">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>
              Disable AI summaries
              <div className="ink-muted text-xs">Hides weekly AI on the Week tab (build flags still required).</div>
            </span>
            <input
              type="checkbox"
              checked={settings.disableAi}
              onChange={(e) => updateSettingsAndMarkDirty({ disableAi: e.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>
              Disable points system
              <div className="ink-muted text-xs">Hides score/streak and disables Shoppe purchases.</div>
            </span>
            <input
              type="checkbox"
              checked={settings.disablePoints}
              onChange={(e) => updateSettingsAndMarkDirty({ disablePoints: e.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>
              Disable notifications
              <div className="ink-muted text-xs">
                Stops permission prompts, in-app alerts, and background push when configured.
              </div>
            </span>
            <input
              type="checkbox"
              checked={settings.disableNotifications}
              onChange={(e) => {
                updateSettingsAndMarkDirty({ disableNotifications: e.target.checked })
                if (e.target.checked) void unsubscribePush()
              }}
            />
          </label>
          {!settings.disableNotifications && perm === 'denied' ? (
            <p className="text-sm" style={{ color: 'var(--danger)' }}>
              {notificationPermissionDeniedHint()}
            </p>
          ) : null}
          <div className="grid gap-3 rounded-2xl border border-[var(--paper-border)] p-4">
            <div className="text-sm font-medium">Package delivery</div>
            <p className="ink-muted text-xs">
              Weekly packages appear after this day and time, once that journal week is complete
              (Monday–Sunday). With cloud sync and push enabled, delivery uses your timezone below;
              otherwise push reminders use Eastern Time.
            </p>
            <label className="grid gap-1 text-sm">
              <span className="ink-muted text-xs font-medium">Delivery day</span>
              <select
                className="focus-ring rounded-2xl border border-[var(--paper-border)] bg-transparent px-3 py-2"
                value={settings.deliveryWeekday}
                onChange={(e) => updateSettingsAndMarkDirty({ deliveryWeekday: Number(e.target.value) })}
              >
                {WEEKDAY_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="ink-muted text-xs font-medium">Delivery time</span>
              <input
                type="time"
                className="focus-ring rounded-2xl border border-[var(--paper-border)] bg-transparent px-3 py-2"
                value={settings.deliveryTimeLocal}
                onChange={(e) => updateSettingsAndMarkDirty({ deliveryTimeLocal: e.target.value })}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="ink-muted text-xs font-medium">Timezone (push)</span>
              <input
                type="text"
                readOnly
                className="focus-ring rounded-2xl border border-[var(--paper-border)] bg-transparent px-3 py-2 opacity-80"
                value={settings.timezone}
                onFocus={() => updateSettingsAndMarkDirty({ timezone: browserTimezone() })}
              />
              <span className="ink-muted text-xs">
                Detected from your device. Focus this field to refresh.
              </span>
            </label>
          </div>
          <SettingsAccountFeatures />
        </div>
      </section>

      <SettingsDebugCloudSection />
      {isAuthDebugPanelEnabled() && !isDebugMode() ? (
        <section className="paper rounded-3xl p-6">
          <DebugAuthSection />
        </section>
      ) : null}
      <AccountSyncSection />

      <section className="paper rounded-3xl p-6">
        <div className="font-paper text-xl">Profile</div>
        <label className="mt-4 grid gap-2">
          <span className="ink-muted text-sm font-medium">Global name (RAW reports)</span>
          <input
            type="text"
            className="focus-ring rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3"
            placeholder={aiNameFallback || 'e.g. Kiya'}
            maxLength={40}
            value={nameDraft}
            onChange={(e) => setNameDraftOverride(e.target.value)}
            onBlur={() => {
              updateSettingsAndMarkDirty({ globalName: nameDraft, globalNameManuallySet: true })
              setNameDraftOverride(null)
            }}
          />
          <div className="ink-muted text-xs">
            {aiNameFallback
              ? `RAW reports use your AI display name (“${aiNameFallback}”) until you set a name here.`
              : 'Used in RAW export reports only. AI weekly preferences use a separate display name on the Week tab.'}
          </div>
        </label>
      </section>
    </div>
    </DeskCharacterLayout>
  )
}

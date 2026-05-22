import { useEffect, useMemo, useState } from 'react'
import { loadAiProfile } from '../compilation/aiProfile'
import { useAppSettings } from '../../shared/settings/useAppSettings'
import { AccountSyncSection } from './AccountSyncSection'
import { SettingsAccountFeatures } from './SettingsAccountFeatures'

export function SettingsPage() {
  const { settings, updateSettings } = useAppSettings()
  const [nameDraft, setNameDraft] = useState(settings.globalName)

  useEffect(() => {
    setNameDraft(settings.globalName)
  }, [settings.globalName])

  const aiNameFallback = useMemo(() => {
    if (settings.globalNameManuallySet || settings.globalName.trim()) return ''
    return loadAiProfile().displayName.trim()
  }, [settings.globalName, settings.globalNameManuallySet])

  return (
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
            onChange={(e) => updateSettings({ reducedMotion: e.target.checked })}
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
              onChange={(e) => updateSettings({ disableAi: e.target.checked })}
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
              onChange={(e) => updateSettings({ disablePoints: e.target.checked })}
            />
          </label>
          <SettingsAccountFeatures />
        </div>
      </section>

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
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() =>
              updateSettings({ globalName: nameDraft, globalNameManuallySet: true })
            }
          />
          <div className="ink-muted text-xs">
            {aiNameFallback
              ? `RAW reports use your AI display name (“${aiNameFallback}”) until you set a name here.`
              : 'Used in RAW export reports only. AI weekly preferences use a separate display name on the Week tab.'}
          </div>
        </label>
      </section>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import {
  loadAppSettings,
  saveAppSettings,
  subscribeSettings,
  type AppSettings,
} from './appSettings'
import { SettingsContext, type SettingsContextValue } from './settingsContext'

function systemPrefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
}

function applyReducedMotionDataset(settings: AppSettings) {
  const on = settings.reducedMotion || systemPrefersReducedMotion()
  if (on) {
    document.documentElement.dataset.reducedMotion = 'true'
  } else {
    delete document.documentElement.dataset.reducedMotion
  }
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => loadAppSettings())

  useEffect(() => {
    applyReducedMotionDataset(settings)
  }, [settings])

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const onChange = () => applyReducedMotionDataset(settings)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [settings])

  useEffect(() => {
    return subscribeSettings(setSettings)
  }, [])

  const value = useMemo<SettingsContextValue>(() => {
    return {
      settings,
      updateSettings: (patch) => {
        const next = saveAppSettings(patch)
        setSettings(next)
        return next
      },
    }
  }, [settings])

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

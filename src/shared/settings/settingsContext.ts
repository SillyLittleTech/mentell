import { createContext } from 'react'
import type { AppSettings } from './appSettings'

export type SettingsContextValue = {
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => AppSettings
}

export const SettingsContext = createContext<SettingsContextValue | null>(null)

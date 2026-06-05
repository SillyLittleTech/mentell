import { useContext } from 'react'
import { SettingsContext } from './settingsContext'

export function useAppSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) {
    throw new Error('useAppSettings must be used within SettingsProvider')
  }
  return ctx
}

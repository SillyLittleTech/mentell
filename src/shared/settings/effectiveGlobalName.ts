import { loadAiProfile } from '../../features/compilation/aiProfile'
import { loadAppSettings, type AppSettings } from './appSettings'

/** Name for RAW exports and account challenges; falls back to AI display name until global name is set in Settings. */
export function getEffectiveGlobalName(settings: AppSettings = loadAppSettings()): string {
  if (settings.globalName.trim()) return settings.globalName.trim()
  if (settings.globalNameManuallySet) return ''
  return loadAiProfile().displayName.trim()
}

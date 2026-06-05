import { loadAiProfile } from '../../features/compilation/aiProfile'
import { loadAppSettings } from './appSettings'

/** Name for RAW exports and account challenges; falls back to AI display name until global name is set in Settings. */
export function getEffectiveGlobalName(): string {
  const settings = loadAppSettings()
  if (settings.globalName.trim()) return settings.globalName
  if (settings.globalNameManuallySet) return ''
  return loadAiProfile().displayName.trim()
}

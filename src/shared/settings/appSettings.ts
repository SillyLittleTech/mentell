import { notifyLocalDataChanged } from '../sync/localDataEvents'
import { scopedStorageKey } from '../storage/storageScope'

const SETTINGS_KEY = scopedStorageKey('mentell.settings')
const SETTINGS_EVENT = 'mentell:settings-changed'

export type AppSettings = {
  reducedMotion: boolean
  disableAi: boolean
  disablePoints: boolean
  globalName: string
  /** When true, RAW reports use only `globalName` (no AI display name fallback). */
  globalNameManuallySet: boolean
  syncPromptDismissed: boolean
}

const DEFAULT_SETTINGS: AppSettings = {
  reducedMotion: false,
  disableAi: false,
  disablePoints: false,
  globalName: '',
  globalNameManuallySet: false,
  syncPromptDismissed: false,
}

function sanitizeGlobalName(raw: string) {
  return raw
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, 40)
    .replace(/[^a-zA-Z\u00C0-\u024F\s'\-]/g, '')
    .trim()
}

export function sanitizeAppSettings(input: Partial<AppSettings>): AppSettings {
  const globalName = sanitizeGlobalName(input.globalName ?? '')
  const globalNameManuallySet =
    Boolean(input.globalNameManuallySet) || globalName.length > 0
  return {
    reducedMotion: Boolean(input.reducedMotion),
    disableAi: Boolean(input.disableAi),
    disablePoints: Boolean(input.disablePoints),
    globalName,
    globalNameManuallySet,
    syncPromptDismissed: Boolean(input.syncPromptDismissed),
  }
}

export function loadAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return sanitizeAppSettings(parsed)
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveAppSettings(input: Partial<AppSettings>): AppSettings {
  const next = sanitizeAppSettings({ ...loadAppSettings(), ...input })
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: next }))
  notifyLocalDataChanged()
  return next
}

export function subscribeSettings(cb: (settings: AppSettings) => void) {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<AppSettings>).detail
    cb(detail ?? loadAppSettings())
  }
  window.addEventListener(SETTINGS_EVENT, handler)
  return () => window.removeEventListener(SETTINGS_EVENT, handler)
}

export function isPointsEnabled() {
  return !loadAppSettings().disablePoints
}

export function isAiEnabledLocally() {
  return !loadAppSettings().disableAi
}

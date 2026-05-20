const SETTINGS_KEY = 'mentell.settings'
const SETTINGS_EVENT = 'mentell:settings-changed'

export type AppSettings = {
  reducedMotion: boolean
  disableAi: boolean
  disablePoints: boolean
  globalName: string
}

const DEFAULT_SETTINGS: AppSettings = {
  reducedMotion: false,
  disableAi: false,
  disablePoints: false,
  globalName: '',
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
  return {
    reducedMotion: Boolean(input.reducedMotion),
    disableAi: Boolean(input.disableAi),
    disablePoints: Boolean(input.disablePoints),
    globalName: sanitizeGlobalName(input.globalName ?? ''),
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

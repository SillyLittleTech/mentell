/** True when running inside a Tauri desktop shell. */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

/** True when running inside a Capacitor native shell. */
export function isCapacitor(): boolean {
  return typeof window !== 'undefined' && 'Capacitor' in window
}

/** True for Tauri or Capacitor packaged builds (not browser/PWA). */
export function isNativeShell(): boolean {
  return isTauri() || isCapacitor()
}

/** True when the page is opened via file:// (offline ZIP). */
export function isFileProtocol(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'file:'
}

/** Offline ZIP build uses hash routing and relative asset paths. */
export function isOfflineZipBuild(): boolean {
  return import.meta.env.VITE_OFFLINE_ZIP === '1'
}

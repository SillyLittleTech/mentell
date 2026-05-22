function envFlag(name: string) {
  return import.meta.env[name] === '1'
}

function hasFirebaseConfig() {
  return Boolean(import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim())
}

export function isFirebaseEnabled() {
  if (!envFlag('VITE_ENABLE_FIREBASE')) return false
  if (!hasFirebaseConfig()) {
    if (import.meta.env.DEV) {
      console.warn('[mentell] VITE_ENABLE_FIREBASE=1 but Firebase config is incomplete')
    }
    return false
  }
  return true
}

export function isFirebaseSyncEnabled() {
  return isFirebaseEnabled() && envFlag('VITE_ENABLE_FIREBASE_SYNC')
}

export function isShareLinksEnabled() {
  return isFirebaseEnabled() && envFlag('VITE_ENABLE_SHARE_LINKS')
}

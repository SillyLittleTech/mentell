/// <reference types="vite/client" />

declare module '*.svg?raw' {
  const content: string
  export default content
}
/// <reference types="vite-plugin-pwa/client" />

declare module 'virtual:pwa-register' {
  export function registerSW(options?: {
    immediate?: boolean
    onNeedRefresh?: () => void
    onOfflineReady?: () => void
  }): (reloadPage?: boolean) => Promise<void>
}

interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string
  readonly VITE_ENABLE_WEEKLY_AI_SUMMARY?: string
  readonly VITE_WEEKLY_AI_ENDPOINT?: string
  readonly VITE_WEEKLY_AI_TOKEN?: string
  readonly VITE_ENABLE_PROJECTOR_AI_SEARCH?: string
  readonly VITE_PROJECTOR_SEARCH_ENDPOINT?: string
  readonly VITE_PROJECTOR_SEARCH_TOKEN?: string
  /** When "1", confirm before closing projector search if follow-ups exist (default off) */
  readonly VITE_ENABLE_PJS_CLOSECONF?: string
  readonly VITE_FEEDBACK_FORM_ENDPOINT?: string
  readonly VITE_FEEDBACK_TURNSTILE_SITE_KEY?: string
  readonly VITE_ENABLE_FIREBASE?: string
  readonly VITE_ENABLE_FIREBASE_SYNC?: string
  readonly VITE_ENABLE_SHARE_LINKS?: string
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
  readonly VITE_DEBUG_FIREBASE_CUSTOM_TOKEN?: string
  readonly VITE_VAPID_PUBLIC_KEY?: string
  readonly VITE_PUSH_API_BASE?: string
  /** When "1", build is embedded in the Tauri desktop shell. */
  readonly VITE_TAURI?: string
  /** Optional override for native/offline email-link continue URL. */
  readonly VITE_NATIVE_AUTH_CONTINUE_URL?: string
  /** When "1", build for offline ZIP (hash routing, relative assets, no PWA). */
  readonly VITE_OFFLINE_ZIP?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

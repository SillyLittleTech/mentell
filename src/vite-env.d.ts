/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string
  readonly VITE_ENABLE_WEEKLY_AI_SUMMARY?: string
  readonly VITE_WEEKLY_AI_ENDPOINT?: string
  readonly VITE_WEEKLY_AI_TOKEN?: string
  readonly VITE_ENABLE_FIREBASE?: string
  readonly VITE_ENABLE_FIREBASE_SYNC?: string
  readonly VITE_ENABLE_SHARE_LINKS?: string
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

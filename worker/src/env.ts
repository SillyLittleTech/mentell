export interface PushEnv {
  AI: Ai
  RATE_LIMIT_KV: KVNamespace
  PUSH_KV: KVNamespace
  WEEKLY_SUMMARY_TOKEN: string
  VAPID_PUBLIC_KEY?: string
  VAPID_PRIVATE_KEY?: string
  FIREBASE_SERVICE_ACCOUNT_JSON?: string
  ALLOWED_HOST_SUFFIXES?: string
}

export type Env = PushEnv

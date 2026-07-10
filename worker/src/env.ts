export interface PushEnv {
  AI: Ai
  RATE_LIMIT_KV: KVNamespace
  PUSH_KV: KVNamespace
  WEEKLY_SUMMARY_TOKEN: string
  /** Optional; falls back to WEEKLY_SUMMARY_TOKEN when unset. */
  PROJECTOR_SEARCH_TOKEN?: string
  /** AI Gateway id for Workers AI (weekly summary + fallbacks). Not for AI Search. */
  AI_GATEWAY_ID?: string
  VAPID_PUBLIC_KEY?: string
  VAPID_PRIVATE_KEY?: string
  FIREBASE_SERVICE_ACCOUNT_JSON?: string
  ALLOWED_HOST_SUFFIXES?: string
  /** Optional AI Search instance binding (mentell-journals). */
  AI_SEARCH?: unknown
}

export type Env = PushEnv

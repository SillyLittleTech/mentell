import { notifyLocalDataChanged } from "../sync/localDataEvents";
import { scopedStorageKey } from "../storage/storageScope";

const SETTINGS_KEY = scopedStorageKey("mentell.settings");
const SETTINGS_EVENT = "mentell:settings-changed";

export const DEFAULT_DELIVERY_WEEKDAY = 1; // Monday (0 = Sunday)
export const DEFAULT_DELIVERY_TIME_LOCAL = "09:00";
export const FALLBACK_PUSH_TIMEZONE = "America/New_York";

export function browserTimezone() {
  try {
    return (
      Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_PUSH_TIMEZONE
    );
  } catch {
    return FALLBACK_PUSH_TIMEZONE;
  }
}

export type AppSettings = {
  reducedMotion: boolean;
  disableAi: boolean;
  aiProvider: 'default' | 'custom';
  aiBaseUrl: string;
  aiApiKey: string;
  aiModel: string;
  disablePoints: boolean;
  globalName: string;
  /** When true, RAW reports use only `globalName` (no AI display name fallback). */
  globalNameManuallySet: boolean;
  syncPromptDismissed: boolean;
  disableNotifications: boolean;
  /** 0 = Sunday … 6 = Saturday (date-fns weekStartsOn: 1) */
  deliveryWeekday: number;
  deliveryTimeLocal: string;
  /** IANA timezone for push delivery (sent to the worker on subscribe) */
  timezone: string;
  notificationEmail: string;
  emailVerified: boolean;
  dailyEmailReminderEnabled: boolean;
  dailyEmailReminderHours: number;
  weeklyEmailEnabled: boolean;
};

const DEFAULT_SETTINGS: AppSettings = {
  reducedMotion: false,
  disableAi: false,
  aiProvider: 'default',
  aiBaseUrl: '',
  aiApiKey: '',
  aiModel: '@cf/meta/llama-3.1-8b-instruct',
  disablePoints: false,
  globalName: "",
  globalNameManuallySet: false,
  syncPromptDismissed: false,
  disableNotifications: false,
  deliveryWeekday: DEFAULT_DELIVERY_WEEKDAY,
  deliveryTimeLocal: DEFAULT_DELIVERY_TIME_LOCAL,
  timezone: browserTimezone(),
  notificationEmail: "",
  emailVerified: false,
  dailyEmailReminderEnabled: false,
  dailyEmailReminderHours: 1,
  weeklyEmailEnabled: false,
};

function sanitizeGlobalName(raw: string) {
  return (
    raw
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1F\x7F]/g, "")
      .trim()
      .slice(0, 40)
      .replace(/[^a-zA-Z\u00C0-\u024F\s'-]/g, "")
      .trim()
  );
}

function sanitizeDeliveryTimeLocal(raw: string | undefined) {
  const m = (raw ?? DEFAULT_DELIVERY_TIME_LOCAL)
    .trim()
    .match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return DEFAULT_DELIVERY_TIME_LOCAL;
  const h = Math.min(23, Math.max(0, Number(m[1])));
  const min = Math.min(59, Math.max(0, Number(m[2])));
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function sanitizeDeliveryWeekday(raw: number | undefined) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_DELIVERY_WEEKDAY;
  return Math.min(6, Math.max(0, Math.trunc(n)));
}

function sanitizeTimezone(raw: string | undefined) {
  const tz = (raw ?? "").trim();
  if (!tz) return browserTimezone();
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch {
    return FALLBACK_PUSH_TIMEZONE;
  }
}

export function sanitizeAppSettings(input: Partial<AppSettings>): AppSettings {
  const globalName = sanitizeGlobalName(input.globalName ?? "");
  const globalNameManuallySet =
    Boolean(input.globalNameManuallySet) || globalName.length > 0;
  return {
    reducedMotion: Boolean(input.reducedMotion),
    disableAi: Boolean(input.disableAi),
    aiProvider: input.aiProvider === 'custom' ? 'custom' : 'default',
    aiBaseUrl: (input.aiBaseUrl ?? '').trim(),
    aiApiKey: (input.aiApiKey ?? '').trim(),
    aiModel: (input.aiModel ?? '').trim() || '@cf/meta/llama-3.1-8b-instruct',
    disablePoints: Boolean(input.disablePoints),
    globalName,
    globalNameManuallySet,
    syncPromptDismissed: Boolean(input.syncPromptDismissed),
    disableNotifications: Boolean(input.disableNotifications),
    deliveryWeekday: sanitizeDeliveryWeekday(input.deliveryWeekday),
    deliveryTimeLocal: sanitizeDeliveryTimeLocal(input.deliveryTimeLocal),
    timezone: sanitizeTimezone(input.timezone),
    notificationEmail: (input.notificationEmail ?? "").trim(),
    emailVerified: Boolean(input.emailVerified),
    dailyEmailReminderEnabled: Boolean(input.dailyEmailReminderEnabled),
    dailyEmailReminderHours: Math.min(4, Math.max(1, Number(input.dailyEmailReminderHours) || 1)),
    weeklyEmailEnabled: Boolean(input.weeklyEmailEnabled),
  };
}

export function loadAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS, timezone: browserTimezone() };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const merged = { ...DEFAULT_SETTINGS, ...parsed };
    if (!parsed.timezone) merged.timezone = browserTimezone();
    return sanitizeAppSettings(merged);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveAppSettings(input: Partial<AppSettings>): AppSettings {
  const next = sanitizeAppSettings({ ...loadAppSettings(), ...input });
  // codeql[js/clear-text-storage-of-sensitive-data] - Local-first app architecture
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: next }));
  notifyLocalDataChanged();
  return next;
}

export function subscribeSettings(cb: (settings: AppSettings) => void) {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<AppSettings>).detail;
    cb(detail ?? loadAppSettings());
  };
  window.addEventListener(SETTINGS_EVENT, handler);
  return () => window.removeEventListener(SETTINGS_EVENT, handler);
}

export function isPointsEnabled() {
  return !loadAppSettings().disablePoints;
}

export function isAiEnabledLocally() {
  return !loadAppSettings().disableAi;
}

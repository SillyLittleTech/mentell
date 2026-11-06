import { stripDateKey } from "../../shared/dates";
import { getDb } from "../../db/schema";
import { isPointsEnabled } from "../../shared/settings/appSettings";
import { scopedStorageKey } from "../../shared/storage/storageScope";
import { notifyLocalDataChanged } from "../../shared/sync/localDataEvents";
import { SCORE_CHANGED_EVENT } from "./scoreEvents";
import {
  applyHbcmCompletion,
  applyHbcmMisses,
  calendarDayGap,
  clampHbcm,
  hbcmDisplayValue,
  migrateStreakToHbcmRaw,
  HBCM_MAX,
} from "./hbcm";

/** Each extra log the same day earns this fraction of the previous log's nominal award. */
const DAILY_LOG_DECAY = 0.5;

const SCORE_KEY = scopedStorageKey("mentell.score.total");
export const SCORE_UPDATED_AT_KEY = scopedStorageKey("mentell.score.updatedAt");

/** Fractional HBCM (Heat-Based Consistency Multiplier), internal 0–5. */
export const HBCM_RAW_STORAGE_KEY = scopedStorageKey("mentell.v2.hbcm.raw");
export const HBCM_LAST_SCORE_DAY_KEY = scopedStorageKey(
  "mentell.v2.hbcm.lastScoreDay",
);
export const HBCM_MIGRATED_FROM_STREAK_KEY = scopedStorageKey(
  "mentell.v2.hbcm.migratedFromStreak",
);

const HBCM_RAW_KEY = HBCM_RAW_STORAGE_KEY;
const LAST_SCORE_DAY_KEY = HBCM_LAST_SCORE_DAY_KEY;
const HBCM_MIGRATED_KEY = HBCM_MIGRATED_FROM_STREAK_KEY;

/** Legacy 1.x keys (cleared after migration). */
const LEGACY_STREAK_KEY = scopedStorageKey("mentell.score.streak");
const LEGACY_LAST_DAY_KEY = scopedStorageKey("mentell.score.lastDay");
const LEGACY_STREAK_FREEZE_KEY = scopedStorageKey(
  "mentell.score.streakFreezes",
);
const LEGACY_STREAK_RESTORE_KEY = scopedStorageKey(
  "mentell.score.streakRestore",
);

export type ScoreResult = {
  base: number;
  bonus: number;
  /** 1 for first log of the day; 0.5, 0.25, … for additional logs */
  dailyMultiplier: number;
  logsTodayBefore: number;
  totalDelta: number;
  nextTotal: number;
  hbcmRaw: number;
  hbcmDisplay: number;
  previousHbcmRaw: number;
  missedDaysApplied: number;
  hbcmDelta: number;
  hint: string | null;
};

export type PackageOpenResult = {
  delta: number;
  nextTotal: number;
  hint: string;
};

export type SpendScoreResult =
  | { ok: true; spent: number; nextTotal: number }
  | {
      ok: false;
      spent: number;
      nextTotal: number;
      reason: "insufficient" | "invalid";
    };

export type ScoreSyncPayload = {
  total?: number;
  /** Prefer 2.x */
  hbcmRaw?: number;
  /** Legacy cloud documents */
  streak?: number;
  lastDay?: string | null;
  /** Legacy — ignored for gameplay after 2.x */
  streakFreezes?: number;
  streakRestore?: unknown;
};

function getFloat(key: string, fallback: number) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function setFloat(key: string, value: number) {
  localStorage.setItem(key, String(value));
}

function getInt(key: string, fallback: number) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function setInt(key: string, value: number) {
  localStorage.setItem(key, String(Math.trunc(value)));
}

function migrateLegacyStreakIfNeeded() {
  if (localStorage.getItem(HBCM_MIGRATED_KEY) === "1") return;

  const existingRaw = localStorage.getItem(HBCM_RAW_KEY);
  if (existingRaw === null) {
    const legacyStreak = getInt(LEGACY_STREAK_KEY, 0);
    setFloat(
      HBCM_RAW_KEY,
      legacyStreak > 0 ? migrateStreakToHbcmRaw(legacyStreak) : 0,
    );
  }

  const last = localStorage.getItem(LAST_SCORE_DAY_KEY);
  if (!last) {
    const legacyLast = localStorage.getItem(LEGACY_LAST_DAY_KEY);
    if (legacyLast) localStorage.setItem(LAST_SCORE_DAY_KEY, legacyLast);
  }

  localStorage.removeItem(LEGACY_STREAK_KEY);
  localStorage.removeItem(LEGACY_LAST_DAY_KEY);
  localStorage.removeItem(LEGACY_STREAK_FREEZE_KEY);
  localStorage.removeItem(LEGACY_STREAK_RESTORE_KEY);

  localStorage.setItem(HBCM_MIGRATED_KEY, "1");
}

function dailyLogMultiplier(logsTodayBefore: number) {
  return Math.pow(DAILY_LOG_DECAY, logsTodayBefore);
}

function buildAwardHint(
  logsTodayBefore: number,
  dailyMultiplier: number,
  totalDelta: number,
  bonus: number,
  hbcmDisplay: number,
  hbcmGained: boolean,
  missedDaysApplied: number,
) {
  const parts: string[] = [];

  if (missedDaysApplied > 0) {
    parts.push(
      missedDaysApplied === 1
        ? "One quiet day (−0.5 consistency heat)"
        : `${missedDaysApplied} quiet days (consistency heat adjusted)`,
    );
  }

  if (logsTodayBefore > 0) {
    const pct = Math.round(dailyMultiplier * 100);
    const ordinal =
      logsTodayBefore === 1
        ? "2nd"
        : logsTodayBefore === 2
          ? "3rd"
          : `${logsTodayBefore + 1}th`;
    parts.push(`${ordinal} log today (${pct}% points, +${totalDelta})`);
  } else if (bonus > 0) {
    parts.push(
      hbcmDisplay === 2
        ? `Consistency bonus unlocked (+${bonus})`
        : `Consistency heat ×${hbcmDisplay} (+${bonus})`,
    );
  } else if (hbcmGained) {
    parts.push("Day logged — consistency heat +1");
  }

  return parts.length ? parts.join(" · ") : null;
}

export async function awardForSubmission(
  dateKey: string,
): Promise<ScoreResult> {
  migrateLegacyStreakIfNeeded();

  if (!isPointsEnabled()) {
    const raw = getFloat(HBCM_RAW_KEY, 0);
    return {
      base: 0,
      bonus: 0,
      dailyMultiplier: 1,
      logsTodayBefore: 0,
      totalDelta: 0,
      nextTotal: getInt(SCORE_KEY, 0),
      hbcmRaw: raw,
      hbcmDisplay: hbcmDisplayValue(raw),
      previousHbcmRaw: raw,
      missedDaysApplied: 0,
      hbcmDelta: 0,
      hint: null,
    };
  }

  const logsTodayBefore = await getDb()
    .entries.where("dateKey")
    .equals(dateKey)
    .count();
  const dailyMultiplier = dailyLogMultiplier(logsTodayBefore);

  const total = getInt(SCORE_KEY, 0);
  let hbcmRaw = clampHbcm(getFloat(HBCM_RAW_KEY, 0));
  const previousHbcmRaw = hbcmRaw;
  const lastScoreDay = localStorage.getItem(LAST_SCORE_DAY_KEY);

  let missedDaysApplied = 0;
  if (lastScoreDay && lastScoreDay !== dateKey) {
    const gap = calendarDayGap(lastScoreDay, dateKey);
    if (gap !== null && gap >= 2) {
      missedDaysApplied = gap - 1;
      hbcmRaw = applyHbcmMisses(hbcmRaw, missedDaysApplied);
    }
  }

  let hbcmGained = false;
  if (logsTodayBefore === 0) {
    const next = applyHbcmCompletion(hbcmRaw);
    if (next > hbcmRaw) hbcmGained = true;
    hbcmRaw = next;
  }

  const hbcmDisplay = hbcmDisplayValue(hbcmRaw);
  const bonus = hbcmDisplay >= 2 ? 50 + Math.max(0, hbcmDisplay - 2) * 25 : 0;
  const base = 100;
  const nominal = base + bonus;
  const totalDelta = Math.max(0, Math.round(nominal * dailyMultiplier));
  const nextTotal = total + totalDelta;

  setInt(SCORE_KEY, nextTotal);
  setFloat(HBCM_RAW_KEY, hbcmRaw);
  localStorage.setItem(LAST_SCORE_DAY_KEY, stripDateKey(dateKey));
  localStorage.setItem(SCORE_UPDATED_AT_KEY, String(Date.now()));

  notifyLocalDataChanged();

  const hint = buildAwardHint(
    logsTodayBefore,
    dailyMultiplier,
    totalDelta,
    bonus,
    hbcmDisplay,
    hbcmGained,
    missedDaysApplied,
  );

  return {
    base,
    bonus,
    dailyMultiplier,
    logsTodayBefore,
    totalDelta,
    nextTotal,
    hbcmRaw,
    hbcmDisplay,
    previousHbcmRaw,
    missedDaysApplied,
    hbcmDelta: hbcmRaw - previousHbcmRaw,
    hint,
  };
}

/** @deprecated 1.x restore window — HBCM does not use restores; kept for cloud doc shape. */
export type StreakRestoreCandidate = {
  streak: number;
  restoreTo: number;
  lastDay: string;
  brokenDateKey: string;
  brokenAt: number;
  missedDays: number;
};

export type ScoreSnapshot = {
  total: number;
  hbcmRaw: number;
  hbcmDisplay: number;
  lastScoreDay: string | null;
  /**
   * Legacy cloud field: 2.x stores HBCM display (0–5) where 1.x stored streak count.
   * @deprecated Prefer hbcmDisplay
   */
  streak: number;
  /** @deprecated Alias of lastScoreDay for Firestore `meta/score` */
  lastDay: string | null;
  streakFreezes: number;
  streakRestore: StreakRestoreCandidate | null;
};

export function getScoreSnapshot(): ScoreSnapshot {
  migrateLegacyStreakIfNeeded();
  const hbcmRaw = clampHbcm(getFloat(HBCM_RAW_KEY, 0));
  const hbcmDisplay = hbcmDisplayValue(hbcmRaw);
  const lastScoreDay = localStorage.getItem(LAST_SCORE_DAY_KEY);
  return {
    total: getInt(SCORE_KEY, 0),
    hbcmRaw,
    hbcmDisplay,
    lastScoreDay,
    streak: hbcmDisplay,
    lastDay: lastScoreDay,
    streakFreezes: 0,
    streakRestore: null,
  };
}

/** Apply a score document from cloud sync or recovery. */
export function applyScoreSnapshotFromSync(
  payload: ScoreSyncPayload,
  updatedAt: number,
) {
  let changed = false;
  migrateLegacyStreakIfNeeded();

  if (
    typeof payload.total === "number" &&
    getInt(SCORE_KEY, 0) !== payload.total
  ) {
    setInt(SCORE_KEY, payload.total);
    changed = true;
  }

  if (typeof payload.hbcmRaw === "number") {
    const next = clampHbcm(payload.hbcmRaw);
    if (getFloat(HBCM_RAW_KEY, 0) !== next) {
      setFloat(HBCM_RAW_KEY, next);
      changed = true;
    }
  } else if (typeof payload.streak === "number") {
    const next = migrateStreakToHbcmRaw(payload.streak);
    if (getFloat(HBCM_RAW_KEY, 0) !== next) {
      setFloat(HBCM_RAW_KEY, next);
      changed = true;
    }
  }

  if (payload.lastDay === null) {
    // preserve local last score day
  } else if (typeof payload.lastDay === "string" && payload.lastDay) {
    const current = localStorage.getItem(LAST_SCORE_DAY_KEY);
    if (!current || payload.lastDay > current) {
      localStorage.setItem(LAST_SCORE_DAY_KEY, payload.lastDay);
      changed = true;
    }
  }

  const nextUpdatedAt = String(Math.trunc(updatedAt));
  if (localStorage.getItem(SCORE_UPDATED_AT_KEY) !== nextUpdatedAt) {
    localStorage.setItem(SCORE_UPDATED_AT_KEY, nextUpdatedAt);
    changed = true;
  }

  if (changed) {
    notifyLocalDataChanged();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(SCORE_CHANGED_EVENT));
    }
  }
}

export function spendScore(spent: number): SpendScoreResult {
  if (!isPointsEnabled()) {
    return {
      ok: false,
      spent: 0,
      nextTotal: getInt(SCORE_KEY, 0),
      reason: "invalid",
    };
  }

  const clean = Math.trunc(spent);
  if (!Number.isFinite(clean) || clean <= 0) {
    return {
      ok: false,
      spent: clean,
      nextTotal: getInt(SCORE_KEY, 0),
      reason: "invalid",
    };
  }

  const total = getInt(SCORE_KEY, 0);
  if (total < clean) {
    return {
      ok: false,
      spent: clean,
      nextTotal: total,
      reason: "insufficient",
    };
  }

  const nextTotal = total - clean;
  setInt(SCORE_KEY, nextTotal);
  localStorage.setItem(SCORE_UPDATED_AT_KEY, String(Date.now()));
  notifyLocalDataChanged();
  return { ok: true, spent: clean, nextTotal };
}

function packageDelta(kind: "weekly" | "monthly" | "yearly") {
  if (kind === "yearly") return 12000;
  if (kind === "monthly") return 3000;
  return 600;
}

export function awardForPackageOpen(
  kind: "weekly" | "monthly" | "yearly",
): PackageOpenResult {
  if (!isPointsEnabled()) {
    return { delta: 0, nextTotal: getInt(SCORE_KEY, 0), hint: "" };
  }

  const total = getInt(SCORE_KEY, 0);
  const delta = packageDelta(kind);
  const nextTotal = total + delta;
  setInt(SCORE_KEY, nextTotal);
  localStorage.setItem(SCORE_UPDATED_AT_KEY, String(Date.now()));
  notifyLocalDataChanged();

  const hint =
    kind === "yearly"
      ? `Yearly package bonus (+${delta})`
      : kind === "monthly"
        ? `Monthly package bonus (+${delta})`
        : `Weekly package bonus (+${delta})`;

  return { delta, nextTotal, hint };
}

/** Debug / tests: set HBCM raw directly (0–5). */
export function debugSetHbcmRaw(raw: number) {
  setFloat(HBCM_RAW_KEY, clampHbcm(raw));
  localStorage.setItem(SCORE_UPDATED_AT_KEY, String(Date.now()));
  notifyLocalDataChanged();
  window.dispatchEvent(new CustomEvent(SCORE_CHANGED_EVENT));
}

export { HBCM_MAX };

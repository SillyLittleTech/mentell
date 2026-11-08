import { useEffect, useMemo, useState, type ReactNode } from "react";
import { addDays, format, startOfWeek } from "date-fns";
import { useNavigate } from "react-router-dom";
import { getDb } from "../../db/schema";
import {
  loadAppSettings,
  saveAppSettings,
} from "../../shared/settings/appSettings";
import { getEffectiveGlobalName } from "../../shared/settings/effectiveGlobalName";
import { makeId } from "../../shared/id";
import {
  getForcePackages,
  getSkipAiCache,
  getSkipSearchRateLimit,
  getSlowMo,
  isDebugMode,
  setForcePackages,
  setSkipAiCache,
  setSkipSearchRateLimit,
  setSlowMo,
} from "../../shared/debug/debugFlags";
import { useOnlineStatus } from "../../shared/offline/useOnlineStatus";
import { setForcedOnlineStatus } from "../../shared/offline/onlineStatus";
import { clearWeeklyAiCache } from "../compilation/weeklyAiCache";
import { weekKeyForDateKey } from "../compilation/weeklyStats";
import { ensurePackage } from "../packages/packageService";
import { clearCatCollection } from "../shop/catCollection";
import { clearShopInventory } from "../shop/shopInventory";
import {
  HBCM_LAST_SCORE_DAY_KEY,
  HBCM_MIGRATED_FROM_STREAK_KEY,
  HBCM_RAW_STORAGE_KEY,
  debugSetHbcmRaw,
  getScoreSnapshot,
} from "../score/scoreService";
import { notifyScoreChanged } from "../score/scoreEvents";
import { assessRisk } from "../safety/riskAssessment";
import {
  debugForegroundNotification,
  debugRequestNotificationPermission,
  debugRunPackageDeliveryNotify,
  debugScheduleDelayedForeground,
  debugUnregisterServiceWorker,
  debugWaitForServiceWorker,
  getNotificationDebugSnapshot,
  sendWorkerPushTest,
  sendWorkerPushTestDelayed,
  syncPushSubscriptionWithResult,
  unsubscribePush,
  type NotificationDebugSnapshot,
} from "./debugNotifications";
import {
  dexieDatabaseName,
  scopedStorageKey,
} from "../../shared/storage/storageScope";
import {
  normalizeEndpointUrl,
  normalizeEnvToken,
} from "../compilation/weeklyAiSummary";
import {
  getOrCreatePushClientId,
  getWorkerApiBase,
  getWorkerAuthHeaders,
} from "../../pwa/pushSubscribe";
import {
  getOrCreateAnonSearchUserId,
  loadAllEntriesForSearch,
  probeProjectorSearchEndpoint,
  requestProjectorSearch,
  toSearchSnapshot,
} from "../compilation/projectorSearch";
import { useAuthOptional } from "../../shared/firebase/authContext";
import {
  emitProjectorDebug,
  makeMockSearchAnswer,
  makeMockSearchEntries,
} from "./projectorDebug";
import { dateKeyForLocalDay } from "../../shared/dates";
import { notifyLocalDataChanged } from "../../shared/sync/localDataEvents";
import { isAuthDebugPanelEnabled } from "../../shared/features/featureFlags";
import { DebugAuthSection } from "./DebugAuthSection";
import { DebugLocalResourcesSection } from "./DebugLocalResourcesSection";
import {
  recordClusterCelebration,
  recordComebackToast,
} from "../celebrations/clusterCelebration";

/** Current ISO week (Mon–Sun) as YYYY-MM-DD keys — seeded data lands in weekly bar + Feelings graph. */
function seedWeekDateKeys(offsetWeeksFromNow = 0): string[] {
  const ref = addDays(new Date(), offsetWeeksFromNow * 7);
  const start = startOfWeek(ref, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) =>
    format(addDays(start, i), "yyyy-MM-dd"),
  );
}

/** Seven date keys for debug seed actions (avoids non-null assertions on indexed access). */
function requireSeedWeekKeys(): [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
] {
  const keys = seedWeekDateKeys(0);
  if (keys.length !== 7) {
    throw new Error("seedWeekDateKeys must return exactly 7 days");
  }
  return [keys[0], keys[1], keys[2], keys[3], keys[4], keys[5], keys[6]];
}

const DEBUG_AI_TESTS = [
  {
    id: "CRISIS",
    label: "SENT_TRIGGER_CRISIS",
    reason: "I am afraid I might hurt myself tonight",
    sentiment: "-" as const,
    emotion: "sad" as const,
  },
  {
    id: "SUPPORT",
    label: "SENT_TRIGGER_SUPPORT",
    reason: "a negative interaction made me feel overwhelmed and alone",
    sentiment: "-" as const,
    emotion: "anxious" as const,
  },
  {
    id: "EXEC",
    label: "SENT_TRIGGER_EXEC",
    reason: "I nailed something important and feel proud of myself",
    sentiment: "+" as const,
    emotion: "happy" as const,
  },
];

/** Documents `sendDebugEmailTest` in this module. */
async function sendDebugEmailTest(
  template: "daily" | "package",
  variables: Record<string, string>,
) {
  const apiBase = getWorkerApiBase();
  if (!apiBase) return `${template} email test: VITE_PUSH_API_BASE is not set`;
  const token = normalizeEnvToken(import.meta.env.VITE_WEEKLY_AI_TOKEN);
  if (!token) return `${template} email test: VITE_WEEKLY_AI_TOKEN is not set`;
  const email = loadAppSettings().notificationEmail.trim();
  if (!email)
    return `${template} email test: save a notification email in Settings first`;

  try {
    const res = await fetch(`${apiBase}/email/test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ email, template, variables }),
    });
    const text = await res.text().catch(() => "");
    let detail = text;
    if (text) {
      try {
        const parsed = JSON.parse(text) as { error?: string; id?: string };
        detail = parsed.error || (parsed.id ? `id ${parsed.id}` : text);
      } catch {
        /* keep raw */
      }
    }
    if (res.ok)
      return `${template} email test: Sent${detail ? ` (${detail})` : ""}`;
    return `${template} email test: Failed (${res.status} ${res.statusText || "No Content"})${detail ? ` — ${detail}` : ""}`;
  } catch (err) {
    return `${template} email test: ${err instanceof Error ? err.message : "Network error"}`;
  }
}

/** Split debug panel filter input into lowercase search terms. */
function normalizeDebugFilterQuery(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[\s,/]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** True when every filter term matches at least one section keyword. */
function debugSectionMatches(query: string, keywords: string[]): boolean {
  const terms = normalizeDebugFilterQuery(query);
  if (terms.length === 0) return true;
  const hay = keywords.map((k) => k.toLowerCase());
  return terms.every((t) => hay.some((h) => h.includes(t) || t.includes(h)));
}

/** Hides children when the debug panel section filter does not match keywords. */
function DebugFilterBlock({
  query,
  keywords,
  children,
}: {
  query: string;
  keywords: string[];
  children: ReactNode;
}): ReactNode {
  if (!debugSectionMatches(query, keywords)) return null;
  return children;
}

/** `DebugPanel` — see module for behavior. */
export function DebugPanel() {
  const enabled = useMemo(() => isDebugMode(), []);
  const navigate = useNavigate();
  const auth = useAuthOptional();
  const isOnline = useOnlineStatus();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [slowMo, setSlowMoState] = useState(getSlowMo());
  const [forcePackages, setForcePackagesState] = useState(getForcePackages());
  const [skipAiCache, setSkipAiCacheState] = useState(getSkipAiCache());
  const [skipSearchRate, setSkipSearchRateState] = useState(
    getSkipSearchRateLimit(),
  );
  const [debugScore, setDebugScore] = useState("");
  const [debugHbcmRaw, setDebugHbcmRaw] = useState("");
  const [notifSnap, setNotifSnap] = useState<NotificationDebugSnapshot | null>(
    null,
  );
  const [notifResult, setNotifResult] = useState<string | null>(null);
  const [aiEndpointResult, setAiEndpointResult] = useState<string | null>(null);
  const [searchDebugResult, setSearchDebugResult] = useState<string | null>(
    null,
  );
  const [fetchEntryIds, setFetchEntryIds] = useState("");
  const [fetchedEntriesPreview, setFetchedEntriesPreview] = useState<
    string | null
  >(null);
  const [riskProbeText, setRiskProbeText] = useState("death");
  const [riskProbeResult, setRiskProbeResult] = useState<string | null>(null);
  const [pushDelaySec, setPushDelaySec] = useState(30);
  const [sectionQuery, setSectionQuery] = useState("");
  const [inspector, setInspector] = useState<{
    entries: number;
    notes: number;
    stickies: number;
    packages: number;
    scoreTotal: string | null;
    hbcmRaw: string | null;
    hbcmDisplay: number | null;
    logStreak: number | null;
    lastScoreDay: string | null;
    recentEntries: Array<{
      dateKey: string;
      sentiment: string;
      warningLevel: string;
    }>;
    recentPackages: Array<{ kind: string; periodKey: string; opened: boolean }>;
  } | null>(null);

  /** Documents `refreshInspector` in this module. */
  async function refreshInspector() {
    const database = getDb();
    const [entries, notes, stickies, packages] = await Promise.all([
      database.entries.count(),
      database.notes.count(),
      database.stickies.count(),
      database.packages.count(),
    ]);

    const recentEntriesRows = await database.entries
      .orderBy("createdAt")
      .reverse()
      .limit(6)
      .toArray();
    const recentPackagesRows = await database.packages
      .orderBy("createdAt")
      .reverse()
      .limit(6)
      .toArray();

    const snap = getScoreSnapshot();
    setInspector({
      entries,
      notes,
      stickies,
      packages,
      scoreTotal: localStorage.getItem(scopedStorageKey("mentell.score.total")),
      hbcmRaw: localStorage.getItem(HBCM_RAW_STORAGE_KEY),
      hbcmDisplay: snap.hbcmDisplay,
      logStreak: snap.logStreak,
      lastScoreDay: snap.lastScoreDay,
      recentEntries: recentEntriesRows.map((e) => ({
        dateKey: e.dateKey,
        sentiment: e.sentiment,
        warningLevel: e.warningLevel,
      })),
      recentPackages: recentPackagesRows.map((p) => ({
        kind: p.kind,
        periodKey: p.periodKey,
        opened: Boolean(p.openedAt),
      })),
    });
  }

  /** Documents `refreshNotifications` in this module. */
  async function refreshNotifications() {
    setNotifSnap(await getNotificationDebugSnapshot());
  }

  /** Documents `ensureLatestEntryWeeklyPackage` in this module. */
  async function ensureLatestEntryWeeklyPackage() {
    const latestEntry = await getDb().entries.orderBy("dateKey").last();
    const periodKey = latestEntry
      ? weekKeyForDateKey(latestEntry.dateKey)
      : `debug-W${Date.now()}`;
    await ensurePackage("weekly", periodKey);
  }

  /** Documents `checkAiEndpoint` in this module. */
  async function checkAiEndpoint() {
    const endpoint = import.meta.env.VITE_WEEKLY_AI_ENDPOINT;
    if (typeof endpoint !== "string" || !endpoint.trim()) {
      setAiEndpointResult("AI endpoint: VITE_WEEKLY_AI_ENDPOINT is not set.");
      return;
    }
    const normalizedEndpoint = normalizeEndpointUrl(endpoint);
    setAiEndpointResult(`Checking ${normalizedEndpoint}…`);
    try {
      const response = await fetch(normalizedEndpoint, { method: "OPTIONS" });
      const routeHint = normalizedEndpoint.endsWith("/weekly-summary")
        ? ""
        : " Expected the Worker /weekly-summary route.";
      const normalizedHint =
        normalizedEndpoint === endpoint ? "" : ` Normalized from ${endpoint}.`;
      const okHint =
        response.status === 204 || response.ok
          ? "ok"
          : response.status === 405
            ? "method not allowed; endpoint may be the wrong route"
            : "unexpected status";
      setAiEndpointResult(
        `AI endpoint ${okHint} (${response.status}).${routeHint}${normalizedHint}`,
      );
    } catch (e) {
      setAiEndpointResult(
        `AI endpoint check failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /** Documents `fillAiTest` in this module. */
  function fillAiTest(test: (typeof DEBUG_AI_TESTS)[number]) {
    window.dispatchEvent(
      new CustomEvent("mentell:debug-ai-test-fill", {
        detail: {
          sentiment: test.sentiment,
          emotion: test.emotion,
          emotionNote: "",
          situation: `${test.label}(${test.reason})`,
          details:
            "Debug AI intervention trigger. Submit this letter to exercise the worker classifier.",
        },
      }),
    );
    setOpen(false);
  }

  /** Documents `runRiskProbe` in this module. */
  async function runRiskProbe() {
    setBusy(true);
    setRiskProbeResult("Running risk workflow…");
    try {
      const risk = await assessRisk(
        {
          dateKey: dateKeyForLocalDay(new Date()),
          sentiment: "=",
          emotion: "other",
          emotionNote: "",
          situation: "",
          details: riskProbeText,
        },
        { forceAi: true },
      );
      const lines = [
        `literal=${risk.literalSentimentLabel} ${risk.literalSentimentConfidence.toFixed(2)} (${risk.literalSentimentScore.toFixed(2)})`,
        `semantic=${risk.semanticRiskLabel} ${risk.semanticRiskConfidence.toFixed(2)} source=${risk.semanticRiskSource}`,
        `response=${risk.responseKind} warning=${risk.warningLevel} risk=${risk.riskScore.toFixed(2)} level=${risk.riskLevel}`,
        `source=${risk.source} model=${risk.sentimentModelSource} guard=${risk.guardSafe === undefined ? "n/a" : risk.guardSafe ? "safe" : "unsafe"}`,
        risk.guardCategories?.length
          ? `guard categories=${risk.guardCategories.join(", ")}`
          : "",
        risk.flaggedTerms.length ? `flags=${risk.flaggedTerms.join(", ")}` : "",
        risk.reasons.length ? `reasons=${risk.reasons.join(", ")}` : "",
        risk.supportiveMessage ? `message=${risk.supportiveMessage}` : "",
      ].filter(Boolean);
      setRiskProbeResult(lines.join("\n"));
    } catch (e) {
      setRiskProbeResult(
        `Risk workflow failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!enabled || !open) return;
    const t = window.setTimeout(() => {
      void refreshInspector();
      void refreshNotifications();
    }, 0);
    return () => window.clearTimeout(t);
  }, [enabled, open]);

  useEffect(() => {
    if (!open || !notifSnap) return;
    if (notifSnap.serviceWorkerReady) return;
    if (
      notifSnap.serviceWorkerState !== "installing" &&
      !notifSnap.serviceWorkerRegistered
    )
      return;
    const id = window.setInterval(() => void refreshNotifications(), 2000);
    return () => window.clearInterval(id);
  }, [open, notifSnap]);

  /** Documents `runNotifAction` in this module. */
  async function runNotifAction(
    label: string,
    fn: () =>
      | Promise<{ ok: boolean; detail: string; status?: number }>
      | { ok: boolean; detail: string; status?: number },
  ) {
    setBusy(true);
    setNotifResult(`${label}…`);
    try {
      const res = await fn();
      const status = res.status ? ` (${res.status})` : "";
      setNotifResult(
        `${label}: ${res.ok ? "ok" : "fail"}${status} — ${res.detail}`,
      );
      await refreshNotifications();
    } catch (e) {
      setNotifResult(
        `${label}: error — ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!enabled) return null;

  return (
    <>
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/25"
          aria-label="Close debug panel"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div className="fixed bottom-5 left-5 z-40 flex max-h-[min(85dvh,calc(100dvh-2.5rem))] flex-col items-start justify-end">
        {open ? (
          <div
            className="paper flex max-h-full w-[min(360px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-3xl shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="debug-panel-title"
          >
            <div className="shrink-0 border-b border-[var(--paper-border)] p-4">
              <div className="flex items-center justify-between gap-2">
                <div
                  id="debug-panel-title"
                  className="font-mono text-sm font-bold"
                >
                  debug
                </div>
                <button
                  type="button"
                  className="focus-ring rounded-xl border border-[var(--paper-border)] px-3 py-1.5 text-xs font-semibold"
                  onClick={() => setOpen(false)}
                >
                  Close
                </button>
              </div>
              <div className="ink-muted mt-1 text-xs">
                Isolated debug storage ({dexieDatabaseName()}) · Esc or backdrop
                to dismiss
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
              <div className="sticky top-0 z-[5] -mx-4 mb-3 border-b border-[var(--paper-border)] bg-[var(--paper-bg)] px-4 pb-3 pt-0">
                <label
                  htmlFor="debug-section-filter"
                  className="font-mono text-[10px] font-bold text-[var(--ink)]"
                >
                  filter sections
                </label>
                <input
                  id="debug-section-filter"
                  type="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  placeholder="e.g. push, seed, score"
                  value={sectionQuery}
                  onChange={(e) => setSectionQuery(e.target.value)}
                  className="focus-ring mt-1 w-full rounded-2xl border border-[var(--paper-border)] bg-transparent px-3 py-2 font-mono text-xs"
                />
              </div>
              <div className="grid gap-2">
                {isAuthDebugPanelEnabled() ? (
                  <DebugFilterBlock
                    query={sectionQuery}
                    keywords={[
                      "auth",
                      "firebase",
                      "deep link",
                      "deeplink",
                      "email",
                      "callback",
                    ]}
                  >
                    <DebugAuthSection />
                  </DebugFilterBlock>
                ) : null}

                <DebugFilterBlock
                  query={sectionQuery}
                  keywords={["playground", "ui lab", "animation", "button"]}
                >
                  <div className="rounded-3xl border border-[var(--paper-border)] p-3">
                    <div className="font-mono text-xs font-bold">
                      playground
                    </div>
                    <div className="mt-2 grid gap-2">
                      <button
                        type="button"
                        className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm font-semibold"
                        onClick={() => {
                          setOpen(false);
                          navigate("/debug/ui-playground");
                        }}
                      >
                        Open UI Playground
                        <div className="ink-muted mt-1 text-xs">
                          Direct route for animation + button testing.
                        </div>
                      </button>
                    </div>
                  </div>
                </DebugFilterBlock>

                <DebugFilterBlock
                  query={sectionQuery}
                  keywords={[
                    "ui toggles",
                    "slow",
                    "slow-mo",
                    "package",
                    "force",
                    "ai",
                    "cache",
                    "search",
                    "rate",
                    "endpoint",
                  ]}
                >
                  <div className="rounded-3xl border border-[var(--paper-border)] p-3">
                    <div className="font-mono text-xs font-bold">
                      ui toggles
                    </div>
                    <div className="mt-2 grid gap-2">
                      <label className="flex items-center justify-between gap-3 text-sm">
                        <span>Slow‑mo animations</span>
                        <select
                          className="focus-ring rounded-2xl border border-[var(--paper-border)] bg-transparent px-3 py-2 text-xs"
                          value={slowMo}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setSlowMo(v);
                            setSlowMoState(v);
                          }}
                        >
                          <option value={0.5}>0.5x</option>
                          <option value={1}>1x</option>
                          <option value={2}>2x</option>
                          <option value={4}>4x</option>
                        </select>
                      </label>

                      <label className="flex items-center justify-between gap-3 text-sm">
                        <span>Force package alert</span>
                        <input
                          type="checkbox"
                          checked={forcePackages}
                          onChange={(e) => {
                            setForcePackages(e.target.checked);
                            setForcePackagesState(e.target.checked);
                          }}
                        />
                      </label>

                      <label className="flex items-center justify-between gap-3 text-sm">
                        <span>Skip AI summary cache</span>
                        <input
                          type="checkbox"
                          checked={skipAiCache}
                          onChange={(e) => {
                            setSkipAiCache(e.target.checked);
                            setSkipAiCacheState(e.target.checked);
                          }}
                        />
                      </label>

                      <label className="flex items-center justify-between gap-3 text-sm">
                        <span>Skip search rate limit</span>
                        <input
                          type="checkbox"
                          checked={skipSearchRate}
                          onChange={(e) => {
                            setSkipSearchRateLimit(e.target.checked);
                            setSkipSearchRateState(e.target.checked);
                          }}
                        />
                      </label>

                      <button
                        type="button"
                        disabled={busy}
                        className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                        onClick={() => void checkAiEndpoint()}
                      >
                        Check AI endpoint
                        <div className="ink-muted text-xs">
                          Verifies VITE_WEEKLY_AI_ENDPOINT and the
                          /weekly-summary route.
                        </div>
                      </button>
                      {aiEndpointResult ? (
                        <div className="ink-muted rounded-2xl border border-[var(--paper-border)] px-3 py-2 font-mono text-[10px]">
                          {aiEndpointResult}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </DebugFilterBlock>

                <DebugFilterBlock
                  query={sectionQuery}
                  keywords={[
                    "projector",
                    "search",
                    "ai search",
                    "index",
                    "entry",
                    "fetch",
                  ]}
                >
                  <div className="rounded-3xl border border-[var(--paper-border)] p-3">
                    <div className="font-mono text-xs font-bold">
                      projector / AI search
                    </div>
                    <div className="mt-2 grid gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                        onClick={() => {
                          setBusy(true);
                          void probeProjectorSearchEndpoint()
                            .then((r) => setSearchDebugResult(r))
                            .finally(() => setBusy(false));
                        }}
                      >
                        Check search endpoint
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                        onClick={() => {
                          setBusy(true);
                          void (async () => {
                            try {
                              const entries = await loadAllEntriesForSearch();
                              const res = await requestProjectorSearch({
                                query: "",
                                mode: "index",
                                entries,
                                userId:
                                  auth?.user?.uid ||
                                  getOrCreateAnonSearchUserId(),
                                forceIndex: true,
                                skipRateLimit: true,
                              });
                              setSearchDebugResult(
                                res.type === "error"
                                  ? res.message
                                  : res.type === "answer"
                                    ? res.text
                                    : `Indexed; got ${res.entries.length} entries back`,
                              );
                            } catch (e) {
                              setSearchDebugResult(
                                e instanceof Error ? e.message : String(e),
                              );
                            } finally {
                              setBusy(false);
                            }
                          })();
                        }}
                      >
                        Force index sync
                        <div className="ink-muted text-xs">
                          POST mode=index with all Dexie entries
                        </div>
                      </button>
                      <button
                        type="button"
                        className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm"
                        onClick={() => {
                          emitProjectorDebug({
                            action: "open-search",
                            seed: makeMockSearchEntries(),
                          });
                          setOpen(false);
                        }}
                      >
                        Render mock entry cards
                      </button>
                      <button
                        type="button"
                        className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm"
                        onClick={() => {
                          emitProjectorDebug({
                            action: "open-search",
                            seed: makeMockSearchAnswer(),
                          });
                          setOpen(false);
                        }}
                      >
                        Render mock plain answer
                      </button>
                      <div className="grid gap-1">
                        <input
                          className="focus-ring rounded-2xl border border-[var(--paper-border)] bg-transparent px-3 py-2 text-xs"
                          placeholder="entry ids, comma-separated"
                          value={fetchEntryIds}
                          onChange={(e) => setFetchEntryIds(e.target.value)}
                        />
                        <button
                          type="button"
                          disabled={busy}
                          className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                          onClick={() => {
                            setBusy(true);
                            void (async () => {
                              try {
                                const ids = fetchEntryIds
                                  .split(",")
                                  .map((s) => s.trim())
                                  .filter(Boolean);
                                const rows = await getDb().entries.bulkGet(ids);
                                const found = rows
                                  .filter(Boolean)
                                  .map((r) => toSearchSnapshot(r!));
                                setFetchedEntriesPreview(
                                  found.length
                                    ? found
                                        .map(
                                          (e) =>
                                            `${e.id} ${e.dateKey} [${e.sentiment}]`,
                                        )
                                        .join("\n")
                                    : "No matching local entries.",
                                );
                                if (found.length) {
                                  emitProjectorDebug({
                                    action: "open-search",
                                    seed: {
                                      type: "entries",
                                      entryIds: found.map((e) => e.id),
                                      entries: found,
                                      preamble:
                                        "Debug fetch by entry IDs (local Dexie).",
                                    },
                                  });
                                  setOpen(false);
                                }
                              } catch (e) {
                                setFetchedEntriesPreview(
                                  e instanceof Error ? e.message : String(e),
                                );
                              } finally {
                                setBusy(false);
                              }
                            })();
                          }}
                        >
                          Fetch by entry IDs
                        </button>
                      </div>
                      {searchDebugResult ? (
                        <div className="ink-muted rounded-2xl border border-[var(--paper-border)] px-3 py-2 font-mono text-[10px]">
                          {searchDebugResult}
                        </div>
                      ) : null}
                      {fetchedEntriesPreview ? (
                        <div className="ink-muted rounded-2xl border border-[var(--paper-border)] px-3 py-2 font-mono text-[10px] whitespace-pre-wrap">
                          {fetchedEntriesPreview}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </DebugFilterBlock>

                <DebugFilterBlock
                  query={sectionQuery}
                  keywords={[
                    "ai",
                    "response",
                    "sentinel",
                    "crisis",
                    "support",
                    "exec",
                    "composer",
                  ]}
                >
                  <div className="rounded-3xl border border-[var(--paper-border)] p-3">
                    <div className="font-mono text-xs font-bold">
                      AI response tests
                    </div>
                    <div className="ink-muted mt-1 text-xs">
                      Fills the composer with debug-only sentinel input.
                      Parentheses become the generated emotion reason.
                    </div>
                    <div className="mt-2 grid gap-2">
                      {DEBUG_AI_TESTS.map((test) => (
                        <button
                          key={test.id}
                          type="button"
                          disabled={busy}
                          className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                          onClick={() => fillAiTest(test)}
                        >
                          {test.label}
                          <div className="ink-muted text-xs">
                            ({test.reason})
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </DebugFilterBlock>

                <DebugFilterBlock
                  query={sectionQuery}
                  keywords={[
                    "local resources",
                    "location",
                    "latitude",
                    "longitude",
                    "zip",
                    "gps",
                    "crisis",
                    "override",
                  ]}
                >
                  <DebugLocalResourcesSection />
                </DebugFilterBlock>

                <DebugFilterBlock
                  query={sectionQuery}
                  keywords={[
                    "risk",
                    "workflow",
                    "probe",
                    "sentiment",
                    "worker",
                  ]}
                >
                  <div className="rounded-3xl border border-[var(--paper-border)] p-3">
                    <div className="font-mono text-xs font-bold">
                      risk workflow probe
                    </div>
                    <div className="mt-2 grid gap-2">
                      <textarea
                        className="focus-ring min-h-20 w-full resize-y rounded-2xl border border-[var(--paper-border)] bg-transparent px-3 py-2 font-paper text-sm"
                        value={riskProbeText}
                        onChange={(e) => setRiskProbeText(e.target.value)}
                      />
                      <div className="grid grid-cols-3 gap-2">
                        {["death", "kill", "I want to kill myself"].map(
                          (sample) => (
                            <button
                              key={sample}
                              type="button"
                              disabled={busy}
                              className="focus-ring rounded-2xl border border-[var(--paper-border)] px-2 py-2 text-xs disabled:opacity-60"
                              onClick={() => setRiskProbeText(sample)}
                            >
                              {sample}
                            </button>
                          ),
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                        onClick={() => void runRiskProbe()}
                      >
                        Run risk workflow
                        <div className="ink-muted text-xs">
                          Uses the local sentiment model and Worker guard when
                          configured.
                        </div>
                      </button>
                      {riskProbeResult ? (
                        <pre className="ink-muted whitespace-pre-wrap rounded-2xl border border-[var(--paper-border)] p-3 font-mono text-[10px]">
                          {riskProbeResult}
                        </pre>
                      ) : null}
                    </div>
                  </div>
                </DebugFilterBlock>

                <DebugFilterBlock
                  query={sectionQuery}
                  keywords={[
                    "notification",
                    "push",
                    "vapid",
                    "sw",
                    "service worker",
                    "permission",
                    "subscribe",
                    "email",
                  ]}
                >
                  <div className="rounded-3xl border border-[var(--paper-border)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-mono text-xs font-bold">
                        notifications
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        className="focus-ring rounded-xl border border-[var(--paper-border)] px-2 py-1 text-xs disabled:opacity-60"
                        onClick={() => void refreshNotifications()}
                      >
                        refresh
                      </button>
                    </div>
                    {notifSnap ? (
                      <dl className="ink-muted mt-2 grid gap-1 font-mono text-[10px] leading-snug">
                        <div>
                          <dt className="inline">permission </dt>
                          <dd className="inline text-[var(--ink)]">
                            {notifSnap.permission}
                          </dd>
                        </div>
                        <div>
                          <dt className="inline">in-app enabled </dt>
                          <dd className="inline text-[var(--ink)]">
                            {notifSnap.enabledInApp ? "yes" : "no"}
                            {notifSnap.disableNotifications
                              ? " (disabled in settings)"
                              : ""}
                          </dd>
                        </div>
                        <div>
                          <dt className="inline">push env </dt>
                          <dd className="inline text-[var(--ink)]">
                            {notifSnap.webPushEnvConfigured
                              ? "configured"
                              : "missing"}
                          </dd>
                        </div>
                        <div>
                          <dt className="inline">worker VAPID </dt>
                          <dd className="inline text-[var(--ink)]">
                            {notifSnap.workerVapidConfigured === null
                              ? "unknown"
                              : notifSnap.workerVapidConfigured
                                ? "ready"
                                : "missing (.dev.vars)"}
                          </dd>
                        </div>
                        <div>
                          <dt className="inline">service worker </dt>
                          <dd className="inline text-[var(--ink)]">
                            {notifSnap.serviceWorkerReady
                              ? "ready"
                              : notifSnap.serviceWorkerRegistered
                                ? notifSnap.serviceWorkerState
                                : "none"}
                          </dd>
                        </div>
                        <div>
                          <dt className="inline">push subscription </dt>
                          <dd className="inline text-[var(--ink)]">
                            {notifSnap.pushSubscriptionActive ? "yes" : "no"}
                          </dd>
                        </div>
                        <div>
                          <dt className="inline">delivery </dt>
                          <dd className="inline text-[var(--ink)]">
                            wd={notifSnap.deliveryWeekday}{" "}
                            {notifSnap.deliveryTimeLocal} {notifSnap.timezone}
                          </dd>
                        </div>
                        {notifSnap.pushApiBase ? (
                          <div className="break-all">
                            <dt className="inline">api </dt>
                            <dd className="inline text-[var(--ink)]">
                              {notifSnap.pushApiBase}
                            </dd>
                          </div>
                        ) : null}
                        {notifSnap.serviceWorkerNote ? (
                          <p className="mt-1 text-[var(--ink)]">
                            {notifSnap.serviceWorkerNote}
                          </p>
                        ) : null}
                      </dl>
                    ) : (
                      <p className="ink-muted mt-2 text-xs">Loading…</p>
                    )}
                    {notifResult ? (
                      <p className="mt-2 break-words font-mono text-[10px] leading-snug text-[var(--ink)]">
                        {notifResult}
                      </p>
                    ) : null}
                    <div className="mt-2 grid gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                        onClick={() =>
                          void runNotifAction("permission", () =>
                            debugRequestNotificationPermission(),
                          )
                        }
                      >
                        Request permission + subscribe
                        <div className="ink-muted text-xs">
                          Prompts OS permission; syncs push if env is set.
                        </div>
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                        onClick={() =>
                          void runNotifAction("foreground", () =>
                            debugForegroundNotification(),
                          )
                        }
                      >
                        Foreground test notification
                        <div className="ink-muted text-xs">
                          Uses Notification API while tab is open.
                        </div>
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                        onClick={() =>
                          void runNotifAction("delivery", () =>
                            debugRunPackageDeliveryNotify(),
                          )
                        }
                      >
                        Run package delivery + notify
                      </button>
                      <label className="grid gap-1 text-sm">
                        <span className="ink-muted text-xs font-medium">
                          Delayed test (seconds)
                        </span>
                        <select
                          className="focus-ring rounded-2xl border border-[var(--paper-border)] bg-transparent px-3 py-2 text-xs"
                          value={pushDelaySec}
                          onChange={(e) =>
                            setPushDelaySec(Number(e.target.value))
                          }
                        >
                          <option value={3}>3</option>
                          <option value={5}>5</option>
                          <option value={10}>10</option>
                          <option value={15}>15</option>
                          <option value={30}>30</option>
                          <option value={45}>45</option>
                          <option value={60}>60</option>
                          <option value={90}>90</option>
                        </select>
                      </label>
                      <button
                        type="button"
                        disabled={busy || !notifSnap?.webPushEnvConfigured}
                        className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                        onClick={() =>
                          void runNotifAction("delayed push", () =>
                            sendWorkerPushTestDelayed(pushDelaySec),
                          )
                        }
                      >
                        Schedule delayed push (close tab OK)
                        <div className="ink-muted text-xs">
                          Worker sends Web Push after the delay — best test for
                          Safari background behavior. Sync push first.
                        </div>
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                        onClick={() =>
                          void runNotifAction("delayed foreground", () =>
                            debugScheduleDelayedForeground(pushDelaySec),
                          )
                        }
                      >
                        Schedule delayed foreground
                        <div className="ink-muted text-xs">
                          Same delay, but uses Notification API — tab must stay
                          open; Safari may suppress while focused.
                        </div>
                      </button>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          className="focus-ring rounded-2xl border border-[var(--paper-border)] px-2 py-2 text-xs font-medium disabled:opacity-60"
                          onClick={() =>
                            void runNotifAction("wait for SW", () =>
                              debugWaitForServiceWorker(),
                            )
                          }
                        >
                          Wait for SW
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          className="focus-ring rounded-2xl border border-[var(--paper-border)] px-2 py-2 text-xs font-medium disabled:opacity-60"
                          onClick={() =>
                            void runNotifAction("unregister SW", () =>
                              debugUnregisterServiceWorker(),
                            )
                          }
                        >
                          Unregister SW
                        </button>
                        <button
                          type="button"
                          disabled={busy || !notifSnap?.webPushEnvConfigured}
                          className="focus-ring rounded-2xl border border-[var(--paper-border)] px-2 py-2 text-xs font-medium disabled:opacity-60"
                          onClick={() =>
                            void runNotifAction("subscribe", () =>
                              syncPushSubscriptionWithResult(),
                            )
                          }
                        >
                          Sync push (worker)
                        </button>
                        <button
                          type="button"
                          disabled={busy || !notifSnap?.webPushEnvConfigured}
                          className="focus-ring rounded-2xl border border-[var(--paper-border)] px-2 py-2 text-xs font-medium disabled:opacity-60"
                          onClick={() =>
                            void runNotifAction("push test", () =>
                              sendWorkerPushTest(),
                            )
                          }
                        >
                          Worker /push/test
                        </button>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                        onClick={() =>
                          void runNotifAction("unsubscribe", async () => {
                            await unsubscribePush();
                            return {
                              ok: true,
                              detail: "Unsubscribed locally + worker",
                            };
                          })
                        }
                      >
                        Unsubscribe push
                        <div className="ink-muted text-xs">
                          If SW was stuck on installing: Unregister SW → reload
                          → Wait for SW → Sync push. Close tab after /push/test
                          for background push.
                        </div>
                      </button>
                    </div>
                  </div>
                </DebugFilterBlock>

                <DebugFilterBlock
                  query={sectionQuery}
                  keywords={[
                    "package",
                    "weekly",
                    "monthly",
                    "yearly",
                    "batch",
                    "truck",
                  ]}
                >
                  <div className="rounded-3xl border border-[var(--paper-border)] p-3">
                    <div className="font-mono text-xs font-bold">packages</div>
                    <div className="mt-2 grid gap-2">
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          className="focus-ring rounded-2xl border border-[var(--paper-border)] px-2 py-2 text-xs font-medium disabled:opacity-60"
                          onClick={async () => {
                            setBusy(true);
                            try {
                              await ensureLatestEntryWeeklyPackage();
                              await refreshInspector();
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          add weekly
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          className="focus-ring rounded-2xl border border-[var(--paper-border)] px-2 py-2 text-xs font-medium disabled:opacity-60"
                          onClick={async () => {
                            setBusy(true);
                            try {
                              await ensurePackage(
                                "monthly",
                                `debug-M${Date.now()}`,
                              );
                              await refreshInspector();
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          add monthly
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          className="focus-ring rounded-2xl border border-[var(--paper-border)] px-2 py-2 text-xs font-medium disabled:opacity-60"
                          onClick={async () => {
                            setBusy(true);
                            try {
                              await ensurePackage(
                                "yearly",
                                `debug-Y${Date.now()}`,
                              );
                              await refreshInspector();
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          add yearly
                        </button>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                        onClick={async () => {
                          // simulate “delivery” by creating unopened packages at once
                          setBusy(true);
                          try {
                            await ensureLatestEntryWeeklyPackage();
                            await ensurePackage(
                              "monthly",
                              `debug-batch-M${Date.now()}`,
                            );
                            await ensurePackage(
                              "yearly",
                              `debug-batch-Y${Date.now()}`,
                            );
                            await refreshInspector();
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Drop a batch (W/M/Y)
                        <div className="ink-muted text-xs">
                          Triggers alert escalation + truck.
                        </div>
                      </button>
                    </div>
                  </div>
                </DebugFilterBlock>

                <DebugFilterBlock
                  query={sectionQuery}
                  keywords={[
                    "score",
                    "trophy",
                    "consistency",
                    "heat",
                    "hbcm",
                    "streak",
                    "missed day",
                    "celebration",
                    "cluster",
                    "comeback",
                  ]}
                >
                  <div className="rounded-3xl border border-[var(--paper-border)] p-3">
                    <div className="font-mono text-xs font-bold">
                      score / consistency heat
                    </div>
                    <div className="mt-2 grid gap-2">
                      <label className="grid gap-1 text-xs">
                        <span className="ink-muted">Total score</span>
                        <input
                          type="number"
                          min={0}
                          className="focus-ring rounded-xl border border-[var(--paper-border)] bg-transparent px-3 py-2 font-mono"
                          value={debugScore}
                          placeholder={inspector?.scoreTotal ?? "0"}
                          onChange={(e) => setDebugScore(e.target.value)}
                        />
                      </label>
                      <label className="grid gap-1 text-xs">
                        <span className="ink-muted">
                          Consistency heat raw (0–5, fractional)
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="focus-ring rounded-xl border border-[var(--paper-border)] bg-transparent px-3 py-2 font-mono"
                          value={debugHbcmRaw}
                          placeholder={inspector?.hbcmRaw ?? "0"}
                          onChange={(e) => setDebugHbcmRaw(e.target.value)}
                        />
                      </label>
                      <button
                        type="button"
                        disabled={busy}
                        className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const totalRaw =
                              debugScore.trim() || inspector?.scoreTotal || "0";
                            const hbcmRawRaw =
                              debugHbcmRaw.trim() || inspector?.hbcmRaw || "0";
                            const total = Math.max(
                              0,
                              Math.trunc(Number(totalRaw)) || 0,
                            );
                            const hbcmRaw = Number(hbcmRawRaw);
                            localStorage.setItem(
                              scopedStorageKey("mentell.score.total"),
                              String(total),
                            );
                            if (Number.isFinite(hbcmRaw)) {
                              debugSetHbcmRaw(hbcmRaw);
                            }
                            notifyScoreChanged();
                            notifyLocalDataChanged();
                            setDebugScore("");
                            setDebugHbcmRaw("");
                            await refreshInspector();
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Apply score &amp; heat
                        <div className="ink-muted text-xs">
                          Updates localStorage, top bar, and cloud sync.
                        </div>
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const missedDay = dateKeyForLocalDay(
                              addDays(new Date(), -2),
                            );
                            localStorage.setItem(
                              HBCM_LAST_SCORE_DAY_KEY,
                              missedDay,
                            );
                            notifyScoreChanged();
                            notifyLocalDataChanged();
                            await refreshInspector();
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Simulate missed day
                        <div className="ink-muted text-xs">
                          Sets last score day to two days ago; next log applies
                          consistency heat gap penalty.
                        </div>
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                        onClick={() => {
                          recordClusterCelebration({
                            milestone: "consistency_week",
                            hbcmDisplay: inspector?.hbcmDisplay ?? 3,
                            at: Date.now(),
                          });
                        }}
                      >
                        Fire cluster_celebration event
                        <div className="ink-muted text-xs">
                          Dispatches mentell:cluster_celebration for UI QA.
                        </div>
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                        onClick={() => {
                          recordComebackToast({ gapDays: 21, at: Date.now() });
                        }}
                      >
                        Fire comeback_toast event
                        <div className="ink-muted text-xs">
                          Dispatches mentell:comeback_toast for UI QA.
                        </div>
                      </button>
                    </div>
                  </div>
                </DebugFilterBlock>

                <DebugFilterBlock
                  query={sectionQuery}
                  keywords={["network", "online", "offline"]}
                >
                  <div className="rounded-3xl border border-[var(--paper-border)] p-3">
                    <div className="font-mono text-xs font-bold">
                      network state
                    </div>
                    <div className="mt-2 grid gap-2">
                      <button
                        type="button"
                        className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm"
                        onClick={() => {
                          setForcedOnlineStatus(!isOnline);
                        }}
                      >
                        Toggle network state (currently{" "}
                        {isOnline ? "online" : "offline"})
                        <div className="ink-muted text-xs">
                          Forces app online/offline for QA (does not change the
                          browser network).
                        </div>
                      </button>
                    </div>
                  </div>
                </DebugFilterBlock>

                <DebugFilterBlock
                  query={sectionQuery}
                  keywords={[
                    "storage",
                    "inspector",
                    "dexie",
                    "indexeddb",
                    "entries",
                    "stickies",
                    "recent",
                  ]}
                >
                  <div className="rounded-3xl border border-[var(--paper-border)] p-3">
                    <div className="font-mono text-xs font-bold">
                      storage inspector
                    </div>
                    <div className="mt-2 grid gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await refreshInspector();
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Refresh inspector
                      </button>

                      {inspector ? (
                        <div className="ink-muted rounded-2xl border border-[var(--paper-border)] p-3 text-xs">
                          <div className="grid grid-cols-2 gap-2">
                            <div>entries: {inspector.entries}</div>
                            <div>packages: {inspector.packages}</div>
                            <div>notes: {inspector.notes}</div>
                            <div>stickies: {inspector.stickies}</div>
                          </div>
                          <div className="mt-2">
                            score: {inspector.scoreTotal ?? "0"} · heat raw:{" "}
                            {inspector.hbcmRaw ?? "—"} · display:{" "}
                            {inspector.hbcmDisplay ?? "—"} · log streak:{" "}
                            {inspector.logStreak ?? "—"}
                          </div>
                          <div className="mt-1">
                            last score day: {inspector.lastScoreDay ?? "—"}
                          </div>
                          <div className="mt-2">
                            recent entries:
                            {inspector.recentEntries.length ? (
                              <ul className="mt-1 list-disc pl-4">
                                {inspector.recentEntries.map((e) => (
                                  <li key={`${e.dateKey}-${e.sentiment}`}>
                                    {e.dateKey} [{e.sentiment}]{" "}
                                    {e.warningLevel === "warn" ? "(!)" : ""}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <div className="mt-1">—</div>
                            )}
                          </div>
                          <div className="mt-2">
                            recent packages:
                            {inspector.recentPackages.length ? (
                              <ul className="mt-1 list-disc pl-4">
                                {inspector.recentPackages.map((p) => (
                                  <li key={`${p.kind}-${p.periodKey}`}>
                                    {p.kind} {p.periodKey}{" "}
                                    {p.opened ? "(opened)" : "(new)"}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <div className="mt-1">—</div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="ink-muted text-xs">
                          No snapshot yet.
                        </div>
                      )}
                    </div>
                  </div>
                </DebugFilterBlock>

                <DebugFilterBlock
                  query={sectionQuery}
                  keywords={[
                    "reset",
                    "clear",
                    "cache",
                    "seed",
                    "sample",
                    "email",
                    "unverify",
                    "risk",
                    "exce",
                    "recall",
                    "local data",
                    "score only",
                    "cat",
                  ]}
                >
                  <button
                    type="button"
                    disabled={busy}
                    className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                    onClick={() => {
                      clearWeeklyAiCache();
                    }}
                  >
                    Clear AI summary cache
                    <div className="ink-muted text-xs">
                      Forces fresh Worker calls on next generate.
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                    onClick={() => {
                      clearCatCollection();
                    }}
                  >
                    Clear cat collection
                    <div className="ink-muted text-xs">
                      Removes mentell.shop.cats from localStorage.
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const database = getDb();
                        await database.entries.clear();
                        await database.notes.clear();
                        await database.stickies.clear();
                        await database.packages.clear();
                        await database.characterAppearance.clear();
                        clearShopInventory();
                        localStorage.removeItem(
                          scopedStorageKey("mentell.score.total"),
                        );
                        localStorage.removeItem(
                          scopedStorageKey("mentell.score.streak"),
                        );
                        localStorage.removeItem(
                          scopedStorageKey("mentell.score.lastDay"),
                        );
                        localStorage.removeItem(
                          scopedStorageKey("mentell.score.streakFreezes"),
                        );
                        localStorage.removeItem(
                          scopedStorageKey("mentell.score.streakRestore"),
                        );
                        localStorage.removeItem(HBCM_RAW_STORAGE_KEY);
                        localStorage.removeItem(HBCM_LAST_SCORE_DAY_KEY);
                        localStorage.removeItem(HBCM_MIGRATED_FROM_STREAK_KEY);
                        window.location.reload();
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Reset local data
                    <div className="ink-muted text-xs">
                      Clears IndexedDB + score + consistency heat keys.
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                    onClick={async () => {
                      localStorage.removeItem(
                        scopedStorageKey("mentell.score.total"),
                      );
                      localStorage.removeItem(
                        scopedStorageKey("mentell.score.streak"),
                      );
                      localStorage.removeItem(
                        scopedStorageKey("mentell.score.lastDay"),
                      );
                      localStorage.removeItem(
                        scopedStorageKey("mentell.score.streakFreezes"),
                      );
                      localStorage.removeItem(
                        scopedStorageKey("mentell.score.streakRestore"),
                      );
                      localStorage.removeItem(HBCM_RAW_STORAGE_KEY);
                      localStorage.removeItem(HBCM_LAST_SCORE_DAY_KEY);
                      localStorage.removeItem(HBCM_MIGRATED_FROM_STREAK_KEY);
                      await refreshInspector();
                    }}
                  >
                    Reset score only
                    <div className="ink-muted text-xs">
                      Keeps IndexedDB, clears score and consistency heat.
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const now = Date.now();
                        const wk = requireSeedWeekKeys();
                        const mk = (
                          dateKey: string,
                          sentiment: "+" | "-" | "=",
                        ) => ({
                          id: makeId("entry"),
                          createdAt: now,
                          updatedAt: now,
                          entryType: "entry" as const,
                          dateKey,
                          sentiment,
                          emotion: "calm" as const,
                          emotionNote: "",
                          situation: `Seeded situation (${sentiment})`,
                          details: `Seeded details for ${dateKey}.\nA little stationery vibe.`,
                          behavioursNoted:
                            sentiment === "-" ? "Withdrew after conflict" : "",
                          reoccurringTheme:
                            sentiment === "-"
                              ? "Avoidance after hard talks"
                              : "",
                          flaggedTerms: [],
                          warningLevel: "none" as const,
                          riskScore: 0,
                          interventionScore: 0,
                          riskLevel: "none" as const,
                          scoreDelta: 100,
                          streakAtSubmit: 1,
                        });
                        await getDb().entries.bulkPut([
                          mk(wk[1], "+"),
                          mk(wk[3], "="),
                          mk(wk[5], "-"),
                        ]);
                        await refreshInspector();
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Seed sample week
                    <div className="ink-muted text-xs">
                      Adds 3 entries for quick projector testing.
                    </div>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const now = Date.now();
                        const wk = requireSeedWeekKeys();
                        const memories = [
                          {
                            dateKey: wk[0],
                            emotion: "calm" as const,
                            emotionNote: "calm after a hard interaction",
                            situation:
                              "Maya helped me reset after a difficult interaction",
                            details:
                              "After a tense interaction at lunch, Maya walked with me to the blue bench by the library. We drank mint tea, watched the rain on the windows, and I remembered I could come back to myself.",
                          },
                          {
                            dateKey: wk[2],
                            emotion: "happy" as const,
                            emotionNote: "proud after a presentation",
                            situation:
                              "I got through the presentation with the green note cards",
                            details:
                              "I was nervous about the history presentation, but I used my green note cards, took one slow breath, and Ms. Rivera said my opening story made the whole room listen.",
                          },
                          {
                            dateKey: wk[4],
                            emotion: "calm" as const,
                            emotionNote: "steady during a deadline",
                            situation:
                              "The deadline felt possible after I broke it into tiny steps",
                            details:
                              "The project deadline stopped feeling overwhelming when I wrote three tiny tasks on a yellow sticky note, played the rain playlist, and finished the hardest paragraph before dinner.",
                          },
                          {
                            dateKey: wk[6],
                            emotion: "happy" as const,
                            emotionNote: "seen by friends",
                            situation:
                              "Friends remembered the strawberry cupcake",
                            details:
                              "Jordan and Priya surprised me with a strawberry cupcake after rehearsal. They remembered the tiny candle joke, and I felt known in a way that stayed warm all evening.",
                          },
                        ];

                        await getDb().entries.bulkPut(
                          memories.map((memory, index) => ({
                            id: makeId("entry"),
                            createdAt: now + index,
                            updatedAt: now + index,
                            entryType: "entry" as const,
                            dateKey: memory.dateKey,
                            sentiment: "+" as const,
                            emotion: memory.emotion,
                            emotionNote: memory.emotionNote,
                            situation: memory.situation,
                            details: memory.details,
                            behavioursNoted: "",
                            reoccurringTheme: "",
                            flaggedTerms: [],
                            warningLevel: "none" as const,
                            riskScore: 0,
                            interventionScore: -1.1,
                            riskLevel: "none" as const,
                            scoreDelta: 100,
                            streakAtSubmit: 1,
                          })),
                        );
                        notifyLocalDataChanged();
                        await refreshInspector();
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Seed recall memories
                    <div className="ink-muted text-xs">
                      Adds detailed positive/calm entries for support-memory
                      recall tests.
                    </div>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const now = Date.now();
                        const wk = requireSeedWeekKeys();
                        await getDb().entries.put({
                          id: makeId("entry"),
                          createdAt: now,
                          updatedAt: now,
                          entryType: "entry",
                          dateKey: wk[2],
                          sentiment: "-" as const,
                          emotion: "sad" as const,
                          emotionNote: "",
                          situation: "Seeded subtle risk entry",
                          details:
                            "I just don't think I can take it anymore. I am just going to do it.",
                          behavioursNoted: "",
                          reoccurringTheme: "",
                          flaggedTerms: ["take it anymore", "going to do it"],
                          warningLevel: "warn" as const,
                          riskScore: 0.22,
                          interventionScore: 1.1,
                          riskLevel: "low" as const,
                          scoreDelta: 100,
                          streakAtSubmit: 1,
                        });
                        await refreshInspector();
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Seed subtle risk entry
                    <div className="ink-muted text-xs">
                      Adds a negative entry useful for AI risk modal testing.
                    </div>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const now = Date.now();
                        const wk = requireSeedWeekKeys();
                        await getDb().entries.put({
                          id: makeId("entry"),
                          createdAt: now,
                          updatedAt: now,
                          entryType: "entry",
                          dateKey: wk[4],
                          sentiment: "+" as const,
                          emotion: "happy" as const,
                          emotionNote: "",
                          situation: "Seeded exce entry",
                          details:
                            "Today was amazing and joyful. I felt grateful, proud, hopeful, calm, loved, and excited about a wonderful win.",
                          behavioursNoted: "",
                          reoccurringTheme: "",
                          flaggedTerms: [],
                          warningLevel: "none" as const,
                          riskScore: 0,
                          interventionScore: -1.3,
                          riskLevel: "none" as const,
                          scoreDelta: 100,
                          streakAtSubmit: 1,
                        });
                        await refreshInspector();
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Seed exce entry
                    <div className="ink-muted text-xs">
                      Adds a highly positive entry for celebration modal
                      testing.
                    </div>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                    onClick={async () => {
                      setBusy(true);
                      try {
                        alert(
                          await sendDebugEmailTest("daily", {
                            global_name: getEffectiveGlobalName(),
                            date: new Date().toISOString().split("T")[0],
                          }),
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Test Daily Email
                    <div className="ink-muted text-xs">
                      Sends daily reminder to your saved email.
                    </div>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                    onClick={async () => {
                      setBusy(true);
                      try {
                        alert(
                          await sendDebugEmailTest("package", {
                            global_name: getEffectiveGlobalName(),
                            date: new Date().toISOString().split("T")[0],
                            ent_count: "5",
                            ent_rank: "⬆",
                            ent_sum: "You had a good week.",
                          }),
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Test Package Email
                    <div className="ink-muted text-xs">
                      Sends package drop email to your saved email.
                    </div>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                    onClick={async () => {
                      setBusy(true);
                      try {
                        saveAppSettings({ emailVerified: false });
                        const apiBase = getWorkerApiBase();
                        if (!apiBase) {
                          alert(
                            "Unverified locally. VITE_PUSH_API_BASE is not set, so the worker record was not cleared.",
                          );
                          return;
                        }
                        const res = await fetch(`${apiBase}/email/unverify`, {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            ...(await getWorkerAuthHeaders()),
                          },
                          body: JSON.stringify({
                            clientId: getOrCreatePushClientId(),
                          }),
                        });
                        const text = await res.text().catch(() => "");
                        let detail = text;
                        if (text) {
                          try {
                            const parsed = JSON.parse(text) as {
                              error?: string;
                              existed?: boolean;
                            };
                            detail =
                              parsed.error ||
                              (parsed.existed === false
                                ? "no worker record"
                                : "worker record cleared");
                          } catch {
                            /* keep raw */
                          }
                        }
                        if (!res.ok) {
                          alert(`Unverify failed (${res.status}): ${detail}`);
                          return;
                        }
                        alert(
                          `Notification email unmarked as verified (${detail}). Save & Subscribe in Settings to send a new link.`,
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Unverify notification email
                    <div className="ink-muted text-xs">
                      Clears local + worker verified state so you can retest the
                      link.
                    </div>
                  </button>
                </DebugFilterBlock>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="focus-ring paper shrink-0 rounded-3xl px-4 py-3 font-mono text-sm font-bold shadow-md"
            onClick={() => setOpen(true)}
          >
            debug
          </button>
        )}
      </div>
    </>
  );
}

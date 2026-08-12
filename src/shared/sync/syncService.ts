import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import {
  getDb,
  type EntryRow,
  type MentellDB,
  type NoteRow,
  type PackageRow,
  type StickyRow,
} from "../../db/schema";
import { scopedStorageKey } from "../storage/storageScope";
import { getFirebaseFirestore } from "../firebase/firebaseApp";
import { isFirebaseSyncEnabled } from "../features/featureFlags";
import { getOnlineStatus } from "../offline/onlineStatus";
import { loadSyncState, saveSyncState } from "./syncState";
import { loadAppSettings, type AppSettings } from "../settings/appSettings";
import {
  getScoreSnapshot,
  applyScoreSnapshotFromSync,
  SCORE_UPDATED_AT_KEY,
} from "../../features/score/scoreService";
import {
  loadAiProfile,
  type AiProfile,
} from "../../features/compilation/aiProfile";
import { loadCatCollection } from "../../features/shop/catCollection";
import {
  CHARACTER_APPEARANCE_ROW_ID,
  applyCharacterAppearanceFromCloud,
} from "../../features/character/characterAppearanceService";
import {
  loadShopInventory,
  applyShopInventoryFromCloud,
} from "../../features/shop/shopInventory";
import { scheduleSharePayloadRefresh } from "../../features/share/shareRefresh";
import { LOCAL_DATA_CHANGED_EVENT } from "./localDataEvents";
import {
  type CloudScoreMeta,
  type CloudScoreSnapshot,
  MAX_SCORE_SNAPSHOTS,
} from "./scoreRecovery";
import {
  resolveScoreConflict,
  shouldApplyRemoteScore,
  shouldPushLocalScore,
  type ScoreSyncContext,
} from "./scoreMerge";

const PUSH_DEBOUNCE_MS = 1200;

let currentUid: string | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushInFlight: Promise<void> | null = null;
let pullInFlight: Promise<void> | null = null;
let unsubs: Unsubscribe[] = [];

export function waitForSync() {
  return (pullInFlight ?? Promise.resolve()).catch(() => {});
}

function fs() {
  const f = getFirebaseFirestore();
  if (!f) throw new Error("Cloud backup is not available");
  return f;
}

function userRef(uid: string, ...segments: string[]) {
  return doc(fs(), "users", uid, ...segments);
}

function rowUpdatedAt(row: { updatedAt?: number; createdAt: number }) {
  return row.updatedAt ?? row.createdAt;
}

function pickNewer<
  T extends { id: string; updatedAt?: number; createdAt: number },
>(local: T | undefined, remote: T): T {
  if (!local) return remote;
  return rowUpdatedAt(remote) >= rowUpdatedAt(local) ? remote : local;
}

function resolveEntry(local: EntryRow | undefined, remote: EntryRow) {
  const normalizedRemote = {
    ...remote,
    interventionScore:
      typeof remote.interventionScore === "number"
        ? remote.interventionScore
        : 0,
    behavioursNoted:
      typeof remote.behavioursNoted === "string" ? remote.behavioursNoted : "",
    reoccurringTheme:
      typeof remote.reoccurringTheme === "string"
        ? remote.reoccurringTheme
        : "",
  };
  return pickNewer(local, normalizedRemote);
}

function resolveNote(local: NoteRow | undefined, remote: NoteRow) {
  return pickNewer(local, remote);
}

function resolveSticky(local: StickyRow | undefined, remote: StickyRow) {
  return pickNewer(local, remote);
}

function resolvePackage(local: PackageRow | undefined, remote: PackageRow) {
  return pickNewer(local, remote);
}

async function pullCollection<
  T extends { id: string; updatedAt?: number; createdAt: number },
>(
  uid: string,
  name: "entries" | "notes" | "stickies" | "packages",
  table:
    | MentellDB["entries"]
    | MentellDB["notes"]
    | MentellDB["stickies"]
    | MentellDB["packages"],
  resolve: (local: T | undefined, remote: T) => T,
) {
  const snap = await getDocs(collection(fs(), "users", uid, name));
  if (snap.empty) return;

  const remotes = snap.docs.map((d) => d.data() as T);
  const remoteIds = remotes.map((r) => r.id);

  // Cast table to any to call bulkGet/bulkPut since its union type confuses TS
  const locals = (await (table as any /* eslint-disable-line @typescript-eslint/no-explicit-any */).bulkGet(remoteIds)) as (T | undefined)[];

  const resolved = remotes.map((remote, idx) => resolve(locals[idx], remote));
  await (table as any /* eslint-disable-line @typescript-eslint/no-explicit-any */).bulkPut(resolved);
}

async function getScoreSyncContext(uid: string): Promise<ScoreSyncContext> {
  const local = getScoreSnapshot();
  const localUpdatedAtStr = localStorage.getItem(SCORE_UPDATED_AT_KEY);
  const localUpdatedAt = localUpdatedAtStr ? Number(localUpdatedAtStr) : 0;
  const localEntryCount = await getDb().entries.count();
  const remoteEntryCount = (
    await getDocs(collection(fs(), "users", uid, "entries"))
  ).size;
  const scoreSnap = await getDoc(userRef(uid, "meta", "score"));
  const remote = scoreSnap.exists()
    ? (scoreSnap.data() as CloudScoreMeta)
    : null;
  const remoteTotal =
    typeof remote?.total === "number" ? Math.trunc(remote.total) : 0;
  const remoteUpdatedAt =
    typeof remote?.updatedAt === "number" ? remote.updatedAt : 0;

  return {
    localTotal: local.total,
    remoteTotal,
    localUpdatedAt,
    remoteUpdatedAt,
    localEntryCount,
    remoteEntryCount,
  };
}

async function pullScoreMeta(uid: string) {
  const scoreSnap = await getDoc(userRef(uid, "meta", "score"));
  if (!scoreSnap.exists()) return;

  const data = scoreSnap.data() as CloudScoreMeta;
  const ctx = await getScoreSyncContext(uid);
  const resolution = resolveScoreConflict(ctx);

  if (shouldApplyRemoteScore(ctx, resolution)) {
    applyScoreSnapshotFromSync(data, ctx.remoteUpdatedAt);
  }
}

async function pullMeta(uid: string) {
  await pullScoreMeta(uid);

  const settingsSnap = await getDoc(userRef(uid, "meta", "settings"));
  if (settingsSnap.exists()) {
    const data = settingsSnap.data() as { settings?: AppSettings };
    if (data.settings) {
      localStorage.setItem(
        scopedStorageKey("mentell.settings"),
        JSON.stringify(data.settings),
      );
      window.dispatchEvent(
        new CustomEvent("mentell:settings-changed", { detail: data.settings }),
      );
    }
  }

  const profileSnap = await getDoc(userRef(uid, "meta", "aiProfile"));
  if (profileSnap.exists()) {
    const data = profileSnap.data() as { profile?: AiProfile };
    if (data.profile) {
      localStorage.setItem(
        scopedStorageKey("mentell.ai.profile"),
        JSON.stringify(data.profile),
      );
    }
  }

  const catsSnap = await getDoc(userRef(uid, "meta", "shopCats"));
  if (catsSnap.exists()) {
    const data = catsSnap.data() as { cats?: unknown };
    if (data.cats) {
      localStorage.setItem(
        scopedStorageKey("mentell.shop.cats"),
        JSON.stringify(data.cats),
      );
    }
  }

  const characterSnap = await getDoc(
    userRef(uid, "meta", "characterAppearance"),
  );
  if (characterSnap.exists()) {
    const data = characterSnap.data() as {
      appearance?: {
        fills?: Record<string, string>;
        toggles?: Record<string, string>;
      };
      updatedAt?: number;
    };
    const remoteUpdatedAt =
      typeof data.updatedAt === "number" && Number.isFinite(data.updatedAt)
        ? Math.trunc(data.updatedAt)
        : 0;
    const local = await getDb().characterAppearance.get(
      CHARACTER_APPEARANCE_ROW_ID,
    );
    const localUpdatedAt = local?.updatedAt ?? 0;
    if (
      data.appearance &&
      typeof data.appearance === "object" &&
      remoteUpdatedAt >= localUpdatedAt
    ) {
      const fills =
        data.appearance.fills && typeof data.appearance.fills === "object"
          ? data.appearance.fills
          : {};
      const toggles =
        data.appearance.toggles && typeof data.appearance.toggles === "object"
          ? data.appearance.toggles
          : {};
      await getDb().characterAppearance.put({
        id: CHARACTER_APPEARANCE_ROW_ID,
        updatedAt: remoteUpdatedAt,
        fills,
        toggles,
      });
      applyCharacterAppearanceFromCloud({ fills, toggles });
    }
  }

  const inventorySnap = await getDoc(userRef(uid, "meta", "shopInventory"));
  if (inventorySnap.exists()) {
    const data = inventorySnap.data() as {
      inventory?: unknown;
      updatedAt?: number;
    };
    const remoteUpdatedAt =
      typeof data.updatedAt === "number" && Number.isFinite(data.updatedAt)
        ? Math.trunc(data.updatedAt)
        : 0;
    const localInventory = loadShopInventory();
    if (data.inventory && remoteUpdatedAt >= localInventory.updatedAt) {
      applyShopInventoryFromCloud({
        ...(data.inventory as object),
        updatedAt: remoteUpdatedAt,
      });
    }
  }
}

async function pushCollection<
  T extends { id: string; updatedAt?: number; createdAt: number },
>(
  uid: string,
  name: "entries" | "notes" | "stickies" | "packages",
  rows: T[],
  options?: { deleteRemoteMissing?: boolean },
) {
  const writes = rows.map((row) =>
    setDoc(userRef(uid, name, row.id), row as DocumentData, { merge: true }),
  );
  if (!options?.deleteRemoteMissing) {
    await Promise.all(writes);
    return;
  }

  const localIds = new Set(rows.map((row) => row.id));
  const remoteSnap = await getDocs(collection(fs(), "users", uid, name));
  const deletes = remoteSnap.docs
    .filter((docSnap) => !localIds.has(docSnap.id))
    .map((docSnap) => deleteDoc(docSnap.ref));
  await Promise.all([...writes, ...deletes]);
}

async function pushMeta(uid: string) {
  const remoteSnap = await getDoc(userRef(uid, "meta", "score"));
  const remote = remoteSnap.exists()
    ? (remoteSnap.data() as CloudScoreMeta)
    : null;
  const ctx = await getScoreSyncContext(uid);
  const resolution = resolveScoreConflict(ctx);
  const shopInventory = loadShopInventory();
  const character = await getDb().characterAppearance.get(
    CHARACTER_APPEARANCE_ROW_ID,
  );
  const now = Date.now();
  const localScoreUpdatedAtStr = localStorage.getItem(SCORE_UPDATED_AT_KEY);
  const localScoreUpdatedAt = localScoreUpdatedAtStr
    ? Number(localScoreUpdatedAtStr)
    : now;
  const remoteTotal = ctx.remoteTotal;

  if (remote && shouldApplyRemoteScore(ctx, resolution)) {
    applyScoreSnapshotFromSync(remote, remote.updatedAt ?? now);
  }

  const scoreAfterGuard = getScoreSnapshot();
  let snapshots: CloudScoreSnapshot[] = Array.isArray(remote?.snapshots)
    ? [...remote.snapshots]
    : [];

  const pushLocalScore = shouldPushLocalScore(ctx, resolution);
  const scoreToWrite = pushLocalScore
    ? scoreAfterGuard
    : {
        total: remoteTotal,
        streak:
          typeof remote?.streak === "number"
            ? Math.trunc(remote.streak)
            : scoreAfterGuard.streak,
        lastDay: remote?.lastDay ?? scoreAfterGuard.lastDay,
        streakFreezes:
          typeof remote?.streakFreezes === "number"
            ? Math.trunc(remote.streakFreezes)
            : scoreAfterGuard.streakFreezes,
        streakRestore: remote?.streakRestore ?? scoreAfterGuard.streakRestore,
      };

  if (
    remote &&
    typeof remote.total === "number" &&
    pushLocalScore &&
    Math.trunc(remote.total) !== scoreAfterGuard.total &&
    Math.trunc(remote.total) > 0
  ) {
    snapshots = [
      {
        total: Math.trunc(remote.total),
        streak:
          typeof remote.streak === "number" ? Math.trunc(remote.streak) : 0,
        lastDay: remote.lastDay ?? null,
        streakFreezes:
          typeof remote.streakFreezes === "number"
            ? Math.trunc(remote.streakFreezes)
            : 0,
        savedAt: remote.updatedAt ?? now,
      },
      ...snapshots,
    ].slice(0, MAX_SCORE_SNAPSHOTS);
  }

  const peakTotal = Math.max(
    scoreToWrite.total,
    remoteTotal,
    typeof remote?.peakTotal === "number" ? Math.trunc(remote.peakTotal) : 0,
  );

  await setDoc(
    userRef(uid, "meta", "score"),
    {
      total: scoreToWrite.total,
      streak: scoreToWrite.streak,
      lastDay: scoreToWrite.lastDay,
      streakFreezes: scoreToWrite.streakFreezes,
      streakRestore: scoreToWrite.streakRestore,
      peakTotal,
      snapshots,
      updatedAt: pushLocalScore
        ? localScoreUpdatedAt
        : (remote?.updatedAt ?? localScoreUpdatedAt),
    },
    { merge: true },
  );

  await setDoc(
    userRef(uid, "meta", "settings"),
    { settings: loadAppSettings(), updatedAt: now },
    { merge: true },
  );

  await setDoc(
    userRef(uid, "meta", "aiProfile"),
    { profile: loadAiProfile(), updatedAt: now },
    { merge: true },
  );

  await setDoc(
    userRef(uid, "meta", "shopCats"),
    { cats: loadCatCollection(), updatedAt: now },
    { merge: true },
  );

  await setDoc(
    userRef(uid, "meta", "shopInventory"),
    {
      inventory: shopInventory,
      updatedAt: Math.max(shopInventory.updatedAt, now),
    },
    { merge: true },
  );

  if (character) {
    await setDoc(
      userRef(uid, "meta", "characterAppearance"),
      {
        appearance: { fills: character.fills, toggles: character.toggles },
        updatedAt: character.updatedAt,
      },
      { merge: true },
    );
  }
}

export async function pushLocalToCloud(uid: string) {
  const [entries, notes, stickies, packages] = await Promise.all([
    getDb().entries.toArray(),
    getDb().notes.toArray(),
    getDb().stickies.toArray(),
    getDb().packages.toArray(),
  ]);
  await Promise.all([
    pushCollection(uid, "entries", entries),
    pushCollection(uid, "notes", notes, { deleteRemoteMissing: true }),
    pushCollection(uid, "stickies", stickies, { deleteRemoteMissing: true }),
    pushCollection(uid, "packages", packages),
    pushMeta(uid),
  ]);
}

export async function pullAndMerge(uid: string) {
  const pull = async () => {
    await Promise.all([
      pullCollection(uid, "entries", getDb().entries, resolveEntry as any // eslint-disable-line @typescript-eslint/no-explicit-any
    ),
      pullCollection(uid, "notes", getDb().notes, resolveNote as any // eslint-disable-line @typescript-eslint/no-explicit-any
    ),
      pullCollection(uid, "stickies", getDb().stickies, resolveSticky as any // eslint-disable-line @typescript-eslint/no-explicit-any
    ),
      pullCollection(uid, "packages", getDb().packages, resolvePackage as any // eslint-disable-line @typescript-eslint/no-explicit-any
    ),
    ]);
    await pullMeta(uid);
    window.dispatchEvent(new CustomEvent("mentell:score-changed"));
  };
  pullInFlight = pull();
  try {
    await pullInFlight;
  } finally {
    pullInFlight = null;
  }
}

function watchCollection<T extends { id: string }>(
  uid: string,
  name: "entries" | "notes" | "stickies" | "packages",
  table:
    | MentellDB["entries"]
    | MentellDB["notes"]
    | MentellDB["stickies"]
    | MentellDB["packages"],
  resolve: (local: T | undefined, remote: T) => T,
) {
  return onSnapshot(collection(fs(), "users", uid, name), (snap) => {
    void (async () => {
      const changes = snap.docChanges();
      if (changes.length === 0) return;

      const removedIds: string[] = [];
      const upsertRemotes: T[] = [];

      for (const change of changes) {
        if (change.type === "removed") {
          removedIds.push(change.doc.id);
        } else {
          upsertRemotes.push(change.doc.data() as T);
        }
      }

      if (removedIds.length > 0) {
        await (table as any /* eslint-disable-line @typescript-eslint/no-explicit-any */).bulkDelete(removedIds);
      }

      if (upsertRemotes.length > 0) {
        const remoteIds = upsertRemotes.map((r) => r.id);
        const locals = (await (table as any /* eslint-disable-line @typescript-eslint/no-explicit-any */).bulkGet(remoteIds)) as (
          | T
          | undefined
        )[];
        const resolved = upsertRemotes.map((remote, idx) =>
          resolve(locals[idx], remote),
        );
        await (table as any /* eslint-disable-line @typescript-eslint/no-explicit-any */).bulkPut(resolved);
      }

      saveSyncState({ lastSyncedAt: Date.now(), lastError: null });
      window.dispatchEvent(new CustomEvent("mentell:score-changed"));
    })();
  });
}

function startListeners(uid: string) {
  stopListeners();
  unsubs = [
    watchCollection(uid, "entries", getDb().entries, resolveEntry as any // eslint-disable-line @typescript-eslint/no-explicit-any
    ),
    watchCollection(uid, "notes", getDb().notes, resolveNote as any // eslint-disable-line @typescript-eslint/no-explicit-any
    ),
    watchCollection(uid, "stickies", getDb().stickies, resolveSticky as any // eslint-disable-line @typescript-eslint/no-explicit-any
    ),
    watchCollection(uid, "packages", getDb().packages, resolvePackage as any // eslint-disable-line @typescript-eslint/no-explicit-any
    ),
  ];
}

function stopListeners() {
  unsubs.forEach((u) => u());
  unsubs = [];
}

export async function enableSync(uid: string, opts?: { forcePush?: boolean }) {
  if (!isFirebaseSyncEnabled()) return;
  currentUid = uid;
  try {
    await pullAndMerge(uid);
    if (opts?.forcePush) {
      await pushLocalToCloud(uid);
    } else {
      const localEntries = await getDb().entries.count();
      const remoteEntries = (
        await getDocs(collection(fs(), "users", uid, "entries"))
      ).size;
      if (localEntries > 0 && remoteEntries === 0) {
        await pushLocalToCloud(uid);
      }
    }
    startListeners(uid);
    saveSyncState({ enabled: true, lastSyncedAt: Date.now(), lastError: null });
    scheduleSharePayloadRefresh();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    saveSyncState({ lastError: msg });
    throw e;
  }
}

export function disableSync() {
  stopListeners();
  currentUid = null;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
}

function canPushToCloud() {
  return Boolean(
    currentUid &&
    loadSyncState().enabled &&
    isFirebaseSyncEnabled() &&
    getOnlineStatus(),
  );
}

async function pushCurrentLocalToCloud() {
  if (!currentUid || !canPushToCloud()) return;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  if (pushInFlight) return pushInFlight;

  const uid = currentUid;
  pushInFlight = pushLocalToCloud(uid)
    .then(() => {
      saveSyncState({ lastSyncedAt: Date.now(), lastError: null });
      scheduleSharePayloadRefresh();
    })
    .catch((e) => {
      saveSyncState({
        lastError: e instanceof Error ? e.message : "Push failed",
      });
    })
    .finally(() => {
      pushInFlight = null;
    });
  return pushInFlight;
}

export function scheduleSyncPush() {
  if (!canPushToCloud()) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushCurrentLocalToCloud();
  }, PUSH_DEBOUNCE_MS);
}

/** Pushes known-fresh local changes immediately when sync is active; otherwise no-ops. */
export async function pushLocalChangesNow() {
  await pushCurrentLocalToCloud();
}

export { notifyLocalDataChanged } from "./localDataEvents";

if (typeof window !== "undefined") {
  window.addEventListener(LOCAL_DATA_CHANGED_EVENT, () => scheduleSyncPush());
}

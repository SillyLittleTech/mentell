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
} from 'firebase/firestore'
import { db, type EntryRow, type NoteRow, type PackageRow, type StickyRow } from '../../db/schema'
import { getFirebaseFirestore } from '../firebase/firebaseApp'
import { isFirebaseSyncEnabled } from '../features/featureFlags'
import { loadSyncState, saveSyncState } from './syncState'
import { loadAppSettings, type AppSettings } from '../settings/appSettings'
import { getScoreSnapshot } from '../../features/score/scoreService'
import { loadAiProfile, type AiProfile } from '../../features/compilation/aiProfile'
import { loadCatCollection } from '../../features/shop/catCollection'
import { scheduleSharePayloadRefresh } from '../../features/share/shareRefresh'
import { LOCAL_DATA_CHANGED_EVENT } from './localDataEvents'

const PUSH_DEBOUNCE_MS = 1200

let currentUid: string | null = null
let pushTimer: ReturnType<typeof setTimeout> | null = null
let unsubs: Unsubscribe[] = []

function fs() {
  const f = getFirebaseFirestore()
  if (!f) throw new Error('Cloud backup is not available')
  return f
}

function userRef(uid: string, ...segments: string[]) {
  return doc(fs(), 'users', uid, ...segments)
}

function rowUpdatedAt(row: { updatedAt?: number; createdAt: number }) {
  return row.updatedAt ?? row.createdAt
}

function pickNewer<T extends { id: string; updatedAt?: number; createdAt: number }>(
  local: T | undefined,
  remote: T,
): T {
  if (!local) return remote
  return rowUpdatedAt(remote) >= rowUpdatedAt(local) ? remote : local
}

async function mergeEntry(local: EntryRow | undefined, remote: EntryRow) {
  const chosen = pickNewer(local, remote)
  await db.entries.put(chosen)
}

async function mergeNote(local: NoteRow | undefined, remote: NoteRow) {
  const chosen = pickNewer(local, remote)
  await db.notes.put(chosen)
}

async function mergeSticky(local: StickyRow | undefined, remote: StickyRow) {
  const chosen = pickNewer(local, remote)
  await db.stickies.put(chosen)
}

async function mergePackage(local: PackageRow | undefined, remote: PackageRow) {
  const chosen = pickNewer(local, remote)
  await db.packages.put(chosen)
}

async function pullCollection<T extends { id: string; updatedAt?: number; createdAt: number }>(
  uid: string,
  name: 'entries' | 'notes' | 'stickies' | 'packages',
  table: typeof db.entries | typeof db.notes | typeof db.stickies | typeof db.packages,
  merge: (local: T | undefined, remote: T) => Promise<void>,
) {
  const snap = await getDocs(collection(fs(), 'users', uid, name))
  for (const d of snap.docs) {
    const remote = d.data() as T
    const local = (await table.get(remote.id)) as T | undefined
    await merge(local, remote)
  }
}

async function pullMeta(uid: string) {
  const scoreSnap = await getDoc(userRef(uid, 'meta', 'score'))
  if (scoreSnap.exists()) {
    const data = scoreSnap.data() as {
      total?: number
      streak?: number
      lastDay?: string | null
    }
    if (typeof data.total === 'number') {
      localStorage.setItem('mentell.score.total', String(Math.trunc(data.total)))
    }
    if (typeof data.streak === 'number') {
      localStorage.setItem('mentell.score.streak', String(Math.trunc(data.streak)))
    }
    if (data.lastDay === null || typeof data.lastDay === 'string') {
      if (data.lastDay) localStorage.setItem('mentell.score.lastDay', data.lastDay)
      else localStorage.removeItem('mentell.score.lastDay')
    }
  }

  const settingsSnap = await getDoc(userRef(uid, 'meta', 'settings'))
  if (settingsSnap.exists()) {
    const data = settingsSnap.data() as { settings?: AppSettings }
    if (data.settings) {
      localStorage.setItem('mentell.settings', JSON.stringify(data.settings))
      window.dispatchEvent(
        new CustomEvent('mentell:settings-changed', { detail: data.settings }),
      )
    }
  }

  const profileSnap = await getDoc(userRef(uid, 'meta', 'aiProfile'))
  if (profileSnap.exists()) {
    const data = profileSnap.data() as { profile?: AiProfile }
    if (data.profile) {
      localStorage.setItem('mentell.ai.profile', JSON.stringify(data.profile))
    }
  }

  const catsSnap = await getDoc(userRef(uid, 'meta', 'shopCats'))
  if (catsSnap.exists()) {
    const data = catsSnap.data() as { cats?: unknown }
    if (data.cats) {
      localStorage.setItem('mentell.shop.cats', JSON.stringify(data.cats))
    }
  }
}

async function pushCollection<T extends { id: string; updatedAt?: number; createdAt: number }>(
  uid: string,
  name: 'entries' | 'notes' | 'stickies' | 'packages',
  rows: T[],
  options?: { deleteRemoteMissing?: boolean },
) {
  const writes = rows.map((row) =>
    setDoc(userRef(uid, name, row.id), row as DocumentData, { merge: true }),
  )
  if (!options?.deleteRemoteMissing) {
    await Promise.all(writes)
    return
  }

  const localIds = new Set(rows.map((row) => row.id))
  const remoteSnap = await getDocs(collection(fs(), 'users', uid, name))
  const deletes = remoteSnap.docs
    .filter((docSnap) => !localIds.has(docSnap.id))
    .map((docSnap) => deleteDoc(docSnap.ref))
  await Promise.all([...writes, ...deletes])
}

async function pushMeta(uid: string) {
  const score = getScoreSnapshot()
  const now = Date.now()
  await setDoc(
    userRef(uid, 'meta', 'score'),
    {
      total: score.total,
      streak: score.streak,
      lastDay: score.lastDay,
      updatedAt: now,
    },
    { merge: true },
  )

  await setDoc(
    userRef(uid, 'meta', 'settings'),
    { settings: loadAppSettings(), updatedAt: now },
    { merge: true },
  )

  await setDoc(
    userRef(uid, 'meta', 'aiProfile'),
    { profile: loadAiProfile(), updatedAt: now },
    { merge: true },
  )

  await setDoc(
    userRef(uid, 'meta', 'shopCats'),
    { cats: loadCatCollection(), updatedAt: now },
    { merge: true },
  )
}

export async function pushLocalToCloud(uid: string) {
  const [entries, notes, stickies, packages] = await Promise.all([
    db.entries.toArray(),
    db.notes.toArray(),
    db.stickies.toArray(),
    db.packages.toArray(),
  ])
  await Promise.all([
    pushCollection(uid, 'entries', entries),
    pushCollection(uid, 'notes', notes, { deleteRemoteMissing: true }),
    pushCollection(uid, 'stickies', stickies, { deleteRemoteMissing: true }),
    pushCollection(uid, 'packages', packages),
    pushMeta(uid),
  ])
}

export async function pullAndMerge(uid: string) {
  await Promise.all([
    pullCollection(uid, 'entries', db.entries, mergeEntry),
    pullCollection(uid, 'notes', db.notes, mergeNote),
    pullCollection(uid, 'stickies', db.stickies, mergeSticky),
    pullCollection(uid, 'packages', db.packages, mergePackage),
  ])
  await pullMeta(uid)
  window.dispatchEvent(new CustomEvent('mentell:score-changed'))
}

function watchCollection<T extends { id: string }>(
  uid: string,
  name: 'entries' | 'notes' | 'stickies' | 'packages',
  table: typeof db.entries | typeof db.notes | typeof db.stickies | typeof db.packages,
  merge: (local: T | undefined, remote: T) => Promise<void>,
) {
  return onSnapshot(collection(fs(), 'users', uid, name), (snap) => {
    void (async () => {
      for (const change of snap.docChanges()) {
        if (change.type === 'removed') {
          await table.delete(change.doc.id)
          continue
        }
        const remote = change.doc.data() as T
        const local = (await table.get(remote.id)) as T | undefined
        await merge(local, remote)
      }
      saveSyncState({ lastSyncedAt: Date.now(), lastError: null })
      window.dispatchEvent(new CustomEvent('mentell:score-changed'))
    })()
  })
}

function startListeners(uid: string) {
  stopListeners()
  unsubs = [
    watchCollection(uid, 'entries', db.entries, mergeEntry),
    watchCollection(uid, 'notes', db.notes, mergeNote),
    watchCollection(uid, 'stickies', db.stickies, mergeSticky),
    watchCollection(uid, 'packages', db.packages, mergePackage),
  ]
}

function stopListeners() {
  unsubs.forEach((u) => u())
  unsubs = []
}

export async function enableSync(uid: string, opts?: { forcePush?: boolean }) {
  if (!isFirebaseSyncEnabled()) return
  currentUid = uid
  try {
    await pullAndMerge(uid)
    if (opts?.forcePush) {
      await pushLocalToCloud(uid)
    } else {
      const localEntries = await db.entries.count()
      const remoteEntries = (await getDocs(collection(fs(), 'users', uid, 'entries'))).size
      if (localEntries > 0 && remoteEntries === 0) {
        await pushLocalToCloud(uid)
      }
    }
    startListeners(uid)
    saveSyncState({ enabled: true, lastSyncedAt: Date.now(), lastError: null })
    scheduleSharePayloadRefresh()
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Sync failed'
    saveSyncState({ lastError: msg })
    throw e
  }
}

export function disableSync() {
  stopListeners()
  currentUid = null
  if (pushTimer) {
    clearTimeout(pushTimer)
    pushTimer = null
  }
}

export function scheduleSyncPush() {
  if (!currentUid || !loadSyncState().enabled || !isFirebaseSyncEnabled()) return
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushTimer = null
    if (!currentUid) return
    void pushLocalToCloud(currentUid)
      .then(() => {
        saveSyncState({ lastSyncedAt: Date.now(), lastError: null })
        scheduleSharePayloadRefresh()
      })
      .catch((e) => {
        saveSyncState({
          lastError: e instanceof Error ? e.message : 'Push failed',
        })
      })
  }, PUSH_DEBOUNCE_MS)
}

export { notifyLocalDataChanged } from './localDataEvents'

if (typeof window !== 'undefined') {
  window.addEventListener(LOCAL_DATA_CHANGED_EVENT, () => scheduleSyncPush())
}

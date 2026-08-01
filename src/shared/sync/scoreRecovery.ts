import { doc, getDoc } from 'firebase/firestore'
import {
  applyScoreSnapshotFromSync,
  getScoreSnapshot,
  type ScoreSyncPayload,
  type StreakRestoreCandidate,
} from '../../features/score/scoreService'
import { getFirebaseFirestore } from '../firebase/firebaseApp'

export type CloudScoreSnapshot = {
  total: number
  streak: number
  lastDay?: string | null
  streakFreezes?: number
  savedAt: number
}

export type CloudScoreMeta = ScoreSyncPayload & {
  updatedAt?: number
  peakTotal?: number
  snapshots?: CloudScoreSnapshot[]
}

const MAX_SCORE_SNAPSHOTS = 12

function userScoreRef(uid: string) {
  const fs = getFirebaseFirestore()
  if (!fs) throw new Error('Cloud backup is not available')
  return doc(fs, 'users', uid, 'meta', 'score')
}

export async function fetchCloudScoreMeta(uid: string): Promise<CloudScoreMeta | null> {
  const snap = await getDoc(userScoreRef(uid))
  if (!snap.exists()) return null
  return snap.data() as CloudScoreMeta
}

export function getRecoverableScoreOptions(meta: CloudScoreMeta | null, localTotal: number) {
  const cloudTotal = typeof meta?.total === 'number' ? Math.trunc(meta.total) : 0
  const peakTotal = Math.max(
    cloudTotal,
    typeof meta?.peakTotal === 'number' ? Math.trunc(meta.peakTotal) : 0,
  )
  const snapshots = (meta?.snapshots ?? [])
    .map((row, index) => ({ ...row, index }))
    .filter((row) => typeof row.total === 'number' && row.total > localTotal)
    .sort((a, b) => b.total - a.total)
  return { cloudTotal, peakTotal, snapshots }
}

export async function restoreScoreFromCloud(
  uid: string,
  source: 'cloud' | 'peak' | { snapshotIndex: number },
): Promise<{ total: number; streak: number }> {
  const meta = await fetchCloudScoreMeta(uid)
  if (!meta) throw new Error('No cloud score backup found for this account.')

  let payload: ScoreSyncPayload
  let updatedAt = meta.updatedAt ?? Date.now()

  if (source === 'cloud') {
    payload = meta
  } else if (source === 'peak') {
    const peak =
      typeof meta.peakTotal === 'number'
        ? Math.trunc(meta.peakTotal)
        : typeof meta.total === 'number'
          ? Math.trunc(meta.total)
          : 0
    if (peak <= 0) throw new Error('No peak score is stored in cloud backup.')
    payload = { ...meta, total: peak }
    updatedAt = Date.now()
  } else {
    const snapshot = meta.snapshots?.[source.snapshotIndex]
    if (!snapshot || typeof snapshot.total !== 'number') {
      throw new Error('That score backup is no longer available.')
    }
    payload = {
      total: snapshot.total,
      streak: snapshot.streak,
      lastDay: snapshot.lastDay ?? null,
      streakFreezes: snapshot.streakFreezes,
      streakRestore: null,
    }
    updatedAt = snapshot.savedAt
  }

  applyScoreSnapshotFromSync(payload, updatedAt)
  const next = getScoreSnapshot()
  return { total: next.total, streak: next.streak }
}

export { MAX_SCORE_SNAPSHOTS }
export type { StreakRestoreCandidate }

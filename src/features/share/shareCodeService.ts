import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  Timestamp,
} from 'firebase/firestore'
import { getFirebaseFirestore } from '../../shared/firebase/firebaseApp'
import { buildSharePayload } from './sharePayloadBuilder'
import { buildShareUrl, formatShareCode, generateShareCode } from './shareLinkUrl'
import type { ShareLinkRecord, SharePermissions, SharePreset } from './shareTypes'

export type { ShareLinkRecord } from './shareTypes'
import type { ShareDashboardPayload } from './shareTypes'

export type PublicShareDoc = {
  ownerUid: string
  createdAt: number
  expiresAt: Timestamp
  label: string
  preset: SharePreset
  permissions: SharePermissions
  ownerDisplayName: string
  shareUrl: string
  payload: ShareDashboardPayload
  payloadUpdatedAt: number
}

function fs() {
  const f = getFirebaseFirestore()
  if (!f) throw new Error('Cloud backup is not available')
  return f
}

/** Firestore rejects `undefined`; omit those fields recursively. */
function stripUndefined<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value
  if (value instanceof Timestamp) return value
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as T
  }
  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (val === undefined) continue
    out[key] = stripUndefined(val)
  }
  return out as T
}

export async function createShareLink(input: {
  uid: string
  preset: SharePreset
  permissions: SharePermissions
  label: string
  ownerDisplayName: string
  expiresAt: number
}): Promise<ShareLinkRecord> {
  const code = generateShareCode()
  const shareUrl = buildShareUrl(code)
  const payload = await buildSharePayload(input.permissions)
  const now = Date.now()

  const publicDoc: PublicShareDoc = {
    ownerUid: input.uid,
    createdAt: now,
    expiresAt: Timestamp.fromMillis(input.expiresAt),
    label: input.label,
    preset: input.preset,
    permissions: input.permissions,
    ownerDisplayName: input.ownerDisplayName,
    shareUrl,
    payload,
    payloadUpdatedAt: now,
  }

  await setDoc(doc(fs(), 'publicShares', code), stripUndefined(publicDoc))
  await setDoc(doc(fs(), 'users', input.uid, 'shareLinks', code), {
    code,
    shareUrl,
    label: input.label,
    preset: input.preset,
    permissions: input.permissions,
    ownerDisplayName: input.ownerDisplayName,
    createdAt: now,
    expiresAt: input.expiresAt,
  })

  return {
    code,
    shareUrl,
    label: input.label,
    preset: input.preset,
    permissions: input.permissions,
    ownerDisplayName: input.ownerDisplayName,
    createdAt: now,
    expiresAt: input.expiresAt,
  }
}

export async function listShareLinks(uid: string): Promise<ShareLinkRecord[]> {
  const snap = await getDocs(collection(fs(), 'users', uid, 'shareLinks'))
  const now = Date.now()
  const rows: ShareLinkRecord[] = []
  for (const d of snap.docs) {
    const data = d.data() as ShareLinkRecord
    if (data.expiresAt > now) rows.push(data)
  }
  return rows.sort((a, b) => b.createdAt - a.createdAt)
}

export async function revokeShareLink(uid: string, code: string) {
  const normalized = formatShareCode(code)
  await deleteDoc(doc(fs(), 'publicShares', normalized))
  await deleteDoc(doc(fs(), 'users', uid, 'shareLinks', normalized))
}

export async function refreshShareLinkPayload(uid: string, code: string) {
  const normalized = formatShareCode(code)
  const ref = doc(fs(), 'publicShares', normalized)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const data = snap.data() as PublicShareDoc
  if (data.ownerUid !== uid) return
  if (data.expiresAt.toMillis() <= Date.now()) return

  const payload = await buildSharePayload(data.permissions)
  await setDoc(
    ref,
    stripUndefined({
      payload,
      payloadUpdatedAt: Date.now(),
    }),
    { merge: true },
  )
}

export async function refreshAllActiveShareLinks(uid: string) {
  const links = await listShareLinks(uid)
  await Promise.all(links.map((l) => refreshShareLinkPayload(uid, l.code)))
}

export async function fetchPublicShare(code: string): Promise<PublicShareDoc | null> {
  const normalized = formatShareCode(code)
  const snap = await getDoc(doc(fs(), 'publicShares', normalized))
  if (!snap.exists()) return null
  const data = snap.data() as PublicShareDoc
  if (data.expiresAt.toMillis() <= Date.now()) return null
  return data
}

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
<<<<<<< Updated upstream
import {
  buildShareUrlForCode,
  buildShareUrlForSlug,
  generateShareCode,
  shareDocIdCandidates,
} from './shareLinkUrl'
import { createProtectedShareEnvelope, reencryptProtectedShareEnvelope } from './shareCrypto'
import type {
  ShareAccessMode,
  ShareDashboardPayload,
  ShareLinkRecord,
  SharePayloadEnvelope,
  SharePermissions,
  SharePreset,
} from './shareTypes'

export type { ShareLinkRecord } from './shareTypes'

type PublicShareBase = {
=======
import { buildShareUrl, formatShareCode, generateShareCode } from './shareLinkUrl'
import type { ShareLinkRecord, SharePermissions, SharePreset } from './shareTypes'

export type { ShareLinkRecord } from './shareTypes'
import type { ShareDashboardPayload } from './shareTypes'

export type PublicShareDoc = {
>>>>>>> Stashed changes
  ownerUid: string
  createdAt: number
  expiresAt: Timestamp
  label: string
  preset: SharePreset
  permissions: SharePermissions
  ownerDisplayName: string
  shareUrl: string
<<<<<<< Updated upstream
  payloadUpdatedAt: number
  mode: ShareAccessMode
}

export type PublicShareDoc =
  | (PublicShareBase & {
      mode: 'snapshot'
      payload: ShareDashboardPayload
    })
  | (PublicShareBase & {
      mode: 'protected'
      payloadEnvelope: SharePayloadEnvelope
    })

type StoredShareLinkRecord = ShareLinkRecord & {
  dataKeyBase64?: string
=======
  payload: ShareDashboardPayload
  payloadUpdatedAt: number
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
  mode?: ShareAccessMode
  viewerCode?: string
}): Promise<ShareLinkRecord> {
  const mode = input.mode ?? 'snapshot'
  const code = mode === 'protected' ? input.uid.trim() : generateShareCode()
  const shareUrl =
    mode === 'protected' ? buildShareUrlForSlug(code) : buildShareUrlForCode(code)
  const payload = await buildSharePayload(input.permissions)
  const now = Date.now()
  const baseRecord: ShareLinkRecord = {
    code,
    shareUrl,
    label: input.label,
    preset: input.preset,
    mode,
    permissions: input.permissions,
    ownerDisplayName: input.ownerDisplayName,
    createdAt: now,
    expiresAt: input.expiresAt,
    renewalPeriodHours: Math.max(1, Math.round((input.expiresAt - now) / (60 * 60 * 1000))),
  }

  if (mode === 'protected') {
    const viewerCode = input.viewerCode?.trim()
    if (!viewerCode) {
      throw new Error('A viewer code is required for permanent share links.')
    }
    const { envelope, dataKeyBase64 } = await createProtectedShareEnvelope(payload, viewerCode)
    const publicDoc: PublicShareDoc = {
      ownerUid: input.uid,
      createdAt: now,
      expiresAt: Timestamp.fromMillis(input.expiresAt),
      label: input.label,
      preset: input.preset,
      permissions: input.permissions,
      ownerDisplayName: input.ownerDisplayName,
      shareUrl,
      payloadUpdatedAt: now,
      mode,
      payloadEnvelope: envelope,
    }

    await setDoc(doc(fs(), 'publicShares', code), stripUndefined(publicDoc))
    await setDoc(
      doc(fs(), 'users', input.uid, 'shareLinks', code),
      stripUndefined({
        ...baseRecord,
        dataKeyBase64,
      }),
    )
    return baseRecord
  }
=======
}): Promise<ShareLinkRecord> {
  const code = generateShareCode()
  const shareUrl = buildShareUrl(code)
  const payload = await buildSharePayload(input.permissions)
  const now = Date.now()
>>>>>>> Stashed changes

  const publicDoc: PublicShareDoc = {
    ownerUid: input.uid,
    createdAt: now,
    expiresAt: Timestamp.fromMillis(input.expiresAt),
    label: input.label,
    preset: input.preset,
    permissions: input.permissions,
    ownerDisplayName: input.ownerDisplayName,
    shareUrl,
<<<<<<< Updated upstream
    payloadUpdatedAt: now,
    mode,
    payload,
  }

  await setDoc(doc(fs(), 'publicShares', code), stripUndefined(publicDoc))
  await setDoc(doc(fs(), 'users', input.uid, 'shareLinks', code), stripUndefined(baseRecord))

  return baseRecord
=======
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
>>>>>>> Stashed changes
}

export async function listShareLinks(uid: string): Promise<ShareLinkRecord[]> {
  const snap = await getDocs(collection(fs(), 'users', uid, 'shareLinks'))
  const now = Date.now()
  const rows: ShareLinkRecord[] = []
  for (const d of snap.docs) {
<<<<<<< Updated upstream
    const data = d.data() as StoredShareLinkRecord
    if (data.mode === 'protected' || data.expiresAt > now) rows.push(data)
=======
    const data = d.data() as ShareLinkRecord
    if (data.expiresAt > now) rows.push(data)
>>>>>>> Stashed changes
  }
  return rows.sort((a, b) => b.createdAt - a.createdAt)
}

export async function revokeShareLink(uid: string, code: string) {
<<<<<<< Updated upstream
  const candidates = shareDocIdCandidates(code)
  await Promise.all(
    candidates.map(async (candidate) => {
      await deleteDoc(doc(fs(), 'publicShares', candidate)).catch(() => {})
      await deleteDoc(doc(fs(), 'users', uid, 'shareLinks', candidate)).catch(() => {})
    }),
  )
}

export async function renewShareLink(uid: string, code: string) {
  const candidates = shareDocIdCandidates(code)
  let ref = doc(fs(), 'publicShares', candidates[0]!)
  let snap = await getDoc(ref)
  if (!snap.exists() && candidates[1]) {
    ref = doc(fs(), 'publicShares', candidates[1])
    snap = await getDoc(ref)
  }
  if (!snap.exists()) return

  const data = snap.data() as PublicShareDoc
  if (data.ownerUid !== uid || data.mode !== 'protected') return

  const linkRef = doc(fs(), 'users', uid, 'shareLinks', snap.id)
  const linkSnap = await getDoc(linkRef)
  if (!linkSnap.exists()) return
  const linkData = linkSnap.data() as StoredShareLinkRecord
  if (!linkData.renewalPeriodHours) return

  const expiresAt = Date.now() + linkData.renewalPeriodHours * 60 * 60 * 1000
  const nextExpiry = Timestamp.fromMillis(expiresAt)
  await Promise.all([
    setDoc(
      ref,
      stripUndefined({
        expiresAt: nextExpiry,
      }),
      { merge: true },
    ),
    setDoc(
      linkRef,
      stripUndefined({
        expiresAt,
      }),
      { merge: true },
    ),
  ])
}

export async function refreshShareLinkPayload(uid: string, code: string) {
  const candidates = shareDocIdCandidates(code)
  let ref = doc(fs(), 'publicShares', candidates[0]!)
  let snap = await getDoc(ref)
  if (!snap.exists()) {
    const alternate = candidates[1]
    if (!alternate) return
    ref = doc(fs(), 'publicShares', alternate)
    snap = await getDoc(ref)
    if (!snap.exists()) return
  }
=======
  const normalized = formatShareCode(code)
  await deleteDoc(doc(fs(), 'publicShares', normalized))
  await deleteDoc(doc(fs(), 'users', uid, 'shareLinks', normalized))
}

export async function refreshShareLinkPayload(uid: string, code: string) {
  const normalized = formatShareCode(code)
  const ref = doc(fs(), 'publicShares', normalized)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
>>>>>>> Stashed changes
  const data = snap.data() as PublicShareDoc
  if (data.ownerUid !== uid) return
  if (data.expiresAt.toMillis() <= Date.now()) return

  const payload = await buildSharePayload(data.permissions)
<<<<<<< Updated upstream
  if (data.mode === 'protected') {
    const linkSnap = await getDoc(doc(fs(), 'users', uid, 'shareLinks', snap.id))
    if (!linkSnap.exists()) return
    const linkData = linkSnap.data() as StoredShareLinkRecord
    if (!linkData.dataKeyBase64) return
    const payloadEnvelope = await reencryptProtectedShareEnvelope(
      payload,
      linkData.dataKeyBase64,
      data.payloadEnvelope,
    )
    await setDoc(
      ref,
      stripUndefined({
        payloadEnvelope,
        payloadUpdatedAt: Date.now(),
      }),
      { merge: true },
    )
    return
  }

=======
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
  const now = Date.now()
  await Promise.all(links.filter((l) => l.expiresAt > now).map((l) => refreshShareLinkPayload(uid, l.code)))
}

export async function fetchPublicShare(code: string): Promise<PublicShareDoc | null> {
  const candidates = shareDocIdCandidates(code)
  let snap = await getDoc(doc(fs(), 'publicShares', candidates[0]!))
  if (!snap.exists() && candidates[1]) {
    snap = await getDoc(doc(fs(), 'publicShares', candidates[1]))
  }
=======
  await Promise.all(links.map((l) => refreshShareLinkPayload(uid, l.code)))
}

export async function fetchPublicShare(code: string): Promise<PublicShareDoc | null> {
  const normalized = formatShareCode(code)
  const snap = await getDoc(doc(fs(), 'publicShares', normalized))
>>>>>>> Stashed changes
  if (!snap.exists()) return null
  const data = snap.data() as PublicShareDoc
  if (data.expiresAt.toMillis() <= Date.now()) return null
  return data
}

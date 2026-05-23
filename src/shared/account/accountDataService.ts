import { deleteUser } from 'firebase/auth'
import { collection, deleteDoc, doc, getDocs } from 'firebase/firestore'
import { getDb } from '../../db/schema'
import { clearCharacterAppearance } from '../../features/character/characterAppearanceService'
import { formatShareCode } from '../../features/share/shareLinkUrl'
import { SCORE_CHANGED_EVENT } from '../../features/score/scoreEvents'
import { getFirebaseAuth, getFirebaseFirestore } from '../firebase/firebaseApp'
import { scopedStorageKey } from '../storage/storageScope'
import { disableSync } from '../sync/syncService'
import { saveSyncState } from '../sync/syncState'

const SCORE_KEYS = [
  scopedStorageKey('mentell.score.total'),
  scopedStorageKey('mentell.score.streak'),
  scopedStorageKey('mentell.score.lastDay'),
] as const

function fs() {
  const f = getFirebaseFirestore()
  if (!f) throw new Error('Cloud backup is not available')
  return f
}

async function deleteSubcollection(uid: string, name: string) {
  const snap = await getDocs(collection(fs(), 'users', uid, name))
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)))
}

export async function clearLocalJournalData() {
  await Promise.all([
    getDb().entries.clear(),
    getDb().notes.clear(),
    getDb().stickies.clear(),
    getDb().packages.clear(),
  ])
  await clearCharacterAppearance()
  for (const key of SCORE_KEYS) localStorage.removeItem(key)
  window.dispatchEvent(new CustomEvent(SCORE_CHANGED_EVENT))
}

export async function deleteCloudAccount(uid: string) {
  const linkSnap = await getDocs(collection(fs(), 'users', uid, 'shareLinks'))
  await Promise.all(
    linkSnap.docs.map(async (d) => {
      const code = formatShareCode(d.id)
      await deleteDoc(doc(fs(), 'publicShares', code)).catch(() => {})
      await deleteDoc(d.ref)
    }),
  )

  await Promise.all([
    deleteSubcollection(uid, 'entries'),
    deleteSubcollection(uid, 'notes'),
    deleteSubcollection(uid, 'stickies'),
    deleteSubcollection(uid, 'packages'),
    deleteSubcollection(uid, 'shareLinks'),
  ])

  const metaIds = ['score', 'settings', 'aiProfile', 'shopCats'] as const
  await Promise.all(
    metaIds.map((id) => deleteDoc(doc(fs(), 'users', uid, 'meta', id)).catch(() => {})),
  )
}

export async function deleteAccount(uid: string) {
  await deleteCloudAccount(uid)
  await clearLocalJournalData()
  localStorage.removeItem(scopedStorageKey('mentell.ai.profile'))
  localStorage.removeItem(scopedStorageKey('mentell.shop.cats'))
  disableSync()
  saveSyncState({ enabled: false, lastSyncedAt: null, lastError: null })

  const auth = getFirebaseAuth()
  const user = auth?.currentUser
  if (!user || user.uid !== uid) return

  try {
    await deleteUser(user)
  } catch (e) {
    const code =
      typeof e === 'object' && e && 'code' in e ? String((e as { code: string }).code) : ''
    if (code === 'auth/requires-recent-login') {
      throw new Error(
        'Google needs a fresh sign-in to delete your account. Sign out, sign in again, then retry.',
      )
    }
    throw e
  }
}

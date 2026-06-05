import { isShareLinksEnabled } from '../../shared/features/featureFlags'
import { loadSyncState } from '../../shared/sync/syncState'
import { getFirebaseAuth } from '../../shared/firebase/firebaseApp'
import { refreshAllActiveShareLinks } from './shareCodeService'

let timer: ReturnType<typeof setTimeout> | null = null

export function scheduleSharePayloadRefresh() {
  if (!isShareLinksEnabled()) return
  if (!loadSyncState().enabled) return
  const auth = getFirebaseAuth()
  const uid = auth?.currentUser?.uid
  if (!uid) return

  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    void refreshAllActiveShareLinks(uid).catch((e) => {
      if (import.meta.env.DEV) {
        console.warn('[mentell] share payload refresh failed', e)
      }
    })
  }, 30_000)
}

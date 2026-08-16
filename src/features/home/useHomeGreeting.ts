import { useEffect, useState } from 'react'
import { useAuthOptional } from '../../shared/firebase/AuthProvider'
import { getEffectiveGlobalName } from '../../shared/settings/effectiveGlobalName'
import { useAppSettings } from '../../shared/settings/useAppSettings'
import { LOCAL_DATA_CHANGED_EVENT } from '../../shared/sync/localDataEvents'
import { resolveHomeGreeting, type ResolvedHomeGreeting } from './resolveHomeGreeting'
import { getOldestUserContentAt } from './userContentAge'

export function useHomeGreeting(context?: string): ResolvedHomeGreeting | null {
  const { settings } = useAppSettings()
  const auth = useAuthOptional()
  const [oldestContentAt, setOldestContentAt] = useState<number | null | undefined>(
    undefined,
  )
  const [, setProfileEpoch] = useState(0)

  useEffect(() => {
    let cancelled = false
    const refresh = () => {
      void getOldestUserContentAt().then((oldest) => {
        if (!cancelled) setOldestContentAt(oldest)
      })
      setProfileEpoch((epoch) => epoch + 1)
    }
    refresh()
    window.addEventListener(LOCAL_DATA_CHANGED_EVENT, refresh)
    return () => {
      cancelled = true
      window.removeEventListener(LOCAL_DATA_CHANGED_EVENT, refresh)
    }
  }, [])

  const displayName = getEffectiveGlobalName(settings)
  if (!displayName && oldestContentAt === undefined) return null
  return resolveHomeGreeting({
    context,
    displayName,
    isLoggedIn: Boolean(auth?.user),
    oldestContentAt: oldestContentAt ?? null,
  })
}

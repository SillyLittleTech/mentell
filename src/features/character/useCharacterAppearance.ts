import { useCallback, useEffect, useState } from 'react'
import {
  defaultCharacterAppearance,
  type CharacterAppearance,
} from './characterAppearance'
import {
  CHARACTER_APPEARANCE_CHANGED_EVENT,
  getCachedCharacterAppearance,
  loadCharacterAppearance,
  resetCharacterAppearance,
  scheduleSaveCharacterAppearance,
} from './characterAppearanceService'

export function useCharacterAppearance() {
  const [appearance, setAppearanceState] = useState<CharacterAppearance>(
    () => getCachedCharacterAppearance() ?? defaultCharacterAppearance(),
  )
  const [ready, setReady] = useState(() => getCachedCharacterAppearance() !== null)

  useEffect(() => {
    let cancelled = false
    void loadCharacterAppearance().then((loaded) => {
      if (cancelled) return
      setAppearanceState(loaded)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onExternalChange = () => {
      const cached = getCachedCharacterAppearance()
      if (cached) setAppearanceState(cached)
    }
    window.addEventListener(CHARACTER_APPEARANCE_CHANGED_EVENT, onExternalChange)
    return () =>
      window.removeEventListener(CHARACTER_APPEARANCE_CHANGED_EVENT, onExternalChange)
  }, [])

  const setAppearance = useCallback(
    (next: CharacterAppearance | ((prev: CharacterAppearance) => CharacterAppearance)) => {
      setAppearanceState((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next
        scheduleSaveCharacterAppearance(resolved)
        return resolved
      })
    },
    [],
  )

  const resetAppearance = useCallback(async () => {
    const next = await resetCharacterAppearance()
    setAppearanceState(next)
  }, [])

  return { appearance, setAppearance, resetAppearance, ready }
}

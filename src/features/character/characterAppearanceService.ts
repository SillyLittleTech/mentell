import { getDb } from '../../db/schema'
import {
  defaultCharacterAppearance,
  type CharacterAppearance,
} from './characterAppearance'

export const CHARACTER_APPEARANCE_ROW_ID = 'default' as const
export const CHARACTER_APPEARANCE_CHANGED_EVENT = 'mentell.character.appearance.changed'

let cache: CharacterAppearance | null = null
let loadPromise: Promise<CharacterAppearance> | null = null
let saveTimer: ReturnType<typeof setTimeout> | undefined

function mergeWithDefaults(stored: CharacterAppearance): CharacterAppearance {
  const defaults = defaultCharacterAppearance()
  return {
    fills: { ...defaults.fills, ...stored.fills },
    toggles: { ...defaults.toggles, ...stored.toggles },
  }
}

function notifyAppearanceChanged() {
  window.dispatchEvent(new CustomEvent(CHARACTER_APPEARANCE_CHANGED_EVENT))
}

export function getCachedCharacterAppearance(): CharacterAppearance | null {
  return cache
}

export async function loadCharacterAppearance(): Promise<CharacterAppearance> {
  if (cache) return cache
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    const row = await getDb().characterAppearance.get(CHARACTER_APPEARANCE_ROW_ID)
    if (row) {
      cache = mergeWithDefaults({ fills: row.fills, toggles: row.toggles })
    } else {
      cache = defaultCharacterAppearance()
    }
    return cache
  })()

  return loadPromise
}

export async function saveCharacterAppearance(appearance: CharacterAppearance) {
  cache = appearance
  const row = {
    id: CHARACTER_APPEARANCE_ROW_ID,
    updatedAt: Date.now(),
    fills: appearance.fills,
    toggles: appearance.toggles,
  }
  await getDb().characterAppearance.put(row)
  notifyAppearanceChanged()
}

export function scheduleSaveCharacterAppearance(appearance: CharacterAppearance) {
  cache = appearance
  if (saveTimer !== undefined) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = undefined
    void saveCharacterAppearance(appearance)
  }, 400)
}

export async function resetCharacterAppearance(): Promise<CharacterAppearance> {
  const next = defaultCharacterAppearance()
  if (saveTimer !== undefined) {
    clearTimeout(saveTimer)
    saveTimer = undefined
  }
  await saveCharacterAppearance(next)
  return next
}

export async function clearCharacterAppearance() {
  if (saveTimer !== undefined) {
    clearTimeout(saveTimer)
    saveTimer = undefined
  }
  cache = null
  loadPromise = null
  await getDb().characterAppearance.clear()
  notifyAppearanceChanged()
}

import { charManifest } from './charManifest'

export type CharacterAppearance = {
  fills: Record<string, string>
  toggles: Record<string, string>
}

export function defaultCharacterAppearance(): CharacterAppearance {
  const defaults = charManifest.appearanceDefaults
  return {
    fills: { ...defaults.fills },
    toggles: { ...defaults.toggles },
  }
}

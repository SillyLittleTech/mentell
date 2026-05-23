import { publicUrl } from '../../shared/publicUrl'
import { MentellCharacter } from './MentellCharacter'
import { useCharacterAppearance } from './useCharacterAppearance'

/** Desk nav icon — live headshot using saved character appearance. */
export function CharacterNavIcon({ className }: { className?: string }) {
  const { appearance, ready } = useCharacterAppearance()

  if (!ready) {
    return (
      <img
        alt=""
        src={publicUrl('/asset/char/headshot.svg')}
        draggable={false}
        className={className ?? 'h-8 w-8 shrink-0 select-none object-contain'}
      />
    )
  }

  return (
    <MentellCharacter
      asset="headshot"
      pose="idle"
      appearance={appearance}
      className={className ?? 'h-8 w-8 shrink-0'}
      title="Character lab"
    />
  )
}

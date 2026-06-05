import { useLocation } from 'react-router-dom'
import { MentellCharacter } from './MentellCharacter'
import { poseForPathname } from './characterPoses'
import { useCharacterAppearance } from './useCharacterAppearance'

/** Small decorative character for desk screens. */
export function CharacterCorner({ className }: { className?: string }) {
  const { pathname } = useLocation()
  const pose = poseForPathname(pathname)
  const { appearance, ready } = useCharacterAppearance()

  if (!ready) return null

  return (
    <MentellCharacter
      pose={pose}
      appearance={appearance}
      className={`pointer-events-none h-32 w-28 shrink-0 sm:h-36 sm:w-32 ${className ?? ''}`}
    />
  )
}

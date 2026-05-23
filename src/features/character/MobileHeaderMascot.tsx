import { useLocation } from 'react-router-dom'
import { MentellCharacter } from './MentellCharacter'
import { poseForPathname } from './characterPoses'
import { useCharacterAppearance } from './useCharacterAppearance'

/** Small route-aware mascot beside score on mobile (hidden md+ where side column shows). */
export function MobileHeaderMascot() {
  const { pathname } = useLocation()
  const { appearance, ready } = useCharacterAppearance()
  if (!ready) return null

  return (
    <MentellCharacter
      pose={poseForPathname(pathname)}
      appearance={appearance}
      className="pointer-events-none h-12 w-10 shrink-0 md:hidden"
      title="Desk companion"
    />
  )
}

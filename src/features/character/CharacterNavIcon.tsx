import { publicUrl } from '../../shared/publicUrl'
import { useMemo } from 'react'
import headshotSvg from '../../../asset/char/headshot.svg?raw'
import { applyCharacterAppearance } from './applyCharacterAppearance'
import type { CharacterAppearance } from './characterAppearance'
import { useCharacterAppearance } from './useCharacterAppearance'

const NAV_BADGE_VIEWBOX = '16 4 68 74'

function buildBadgeSrc(appearance: CharacterAppearance) {
  const parsed = new DOMParser().parseFromString(headshotSvg, 'image/svg+xml')
  const svg = parsed.querySelector('svg')
  if (!(svg instanceof SVGSVGElement)) return null
  svg.setAttribute('width', '96')
  svg.setAttribute('height', '96')
  svg.setAttribute('viewBox', NAV_BADGE_VIEWBOX)
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
  if (appearance) applyCharacterAppearance(svg, appearance)
  const serialized = new XMLSerializer().serializeToString(svg)
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`
}

/** Desk nav icon — live headshot using saved character appearance. */
export function CharacterNavIcon({ className }: { className?: string }) {
  const { appearance, ready } = useCharacterAppearance()
  const badgeSrc = useMemo(() => buildBadgeSrc(appearance), [appearance])

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
    <img
      alt=""
      src={badgeSrc ?? publicUrl('/asset/char/headshot.svg')}
      draggable={false}
      className={className ?? 'h-8 w-8 shrink-0 select-none object-contain'}
    />
  )
}

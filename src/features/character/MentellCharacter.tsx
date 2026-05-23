import { useLayoutEffect, useRef, useState } from 'react'
import charSvg from '../../../asset/char/charprod.svg?raw'
import headshotSvg from '../../../asset/char/headshot.svg?raw'
import { applyCharacterAppearance } from './applyCharacterAppearance'
import { charManifest } from './charManifest'
import {
  defaultCharacterAppearance,
  type CharacterAppearance,
} from './characterAppearance'
import type { CharacterPoseId } from './charManifest'
import { CHARACTER_POSES } from './characterPoses'
import { useCharacterBlink } from './characterBlink'
import { useArmPoseAnimation } from './useArmPoseAnimation'
import { useCharacterAppearance } from './useCharacterAppearance'

const DEFAULT_APPEARANCE = defaultCharacterAppearance()

const SVG_SOURCE = {
  character: charSvg,
  headshot: headshotSvg,
} as const

export type CharacterAsset = keyof typeof SVG_SOURCE

export type MentellCharacterProps = {
  pose: CharacterPoseId
  asset?: CharacterAsset
  appearance?: CharacterAppearance
  className?: string
  title?: string
}

function bringElementToFront(svg: SVGSVGElement, id: string | undefined) {
  if (!id) return
  const el = svg.getElementById(id)
  const parent = el?.parentElement
  if (!el || !parent) return
  parent.appendChild(el)
}

function promoteAnimatedArmLayers(svg: SVGSVGElement) {
  const sleeveParentId =
    charManifest.globalFillGroups.find((group) => group.key === 'sleeves')?.parentId ?? 'layer19'
  bringElementToFront(svg, sleeveParentId)
  bringElementToFront(svg, charManifest.arms.armL.jointId)
  bringElementToFront(svg, charManifest.arms.armR.jointId)
}

export function MentellCharacter({
  pose,
  asset = 'character',
  appearance: appearanceProp,
  className,
  title,
}: MentellCharacterProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const [svgGeneration, setSvgGeneration] = useState(0)
  const { appearance: storedAppearance } = useCharacterAppearance()
  const appearance = appearanceProp ?? storedAppearance ?? DEFAULT_APPEARANCE
  const appearanceKey = JSON.stringify(appearance)
  const armPose = CHARACTER_POSES[pose]
  const isBody = asset === 'character'

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    host.innerHTML = SVG_SOURCE[asset]
    const svg = host.querySelector('svg')
    if (!svg) return
    svgRef.current = svg
    svg.setAttribute('width', '100%')
    svg.setAttribute('height', '100%')
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
    svg.style.display = 'block'
    svg.style.overflow = asset === 'headshot' ? 'hidden' : 'visible'
    if (asset === 'character') {
      // Keep animated arms/sleeves painted above torso across SVG reorder tweaks.
      promoteAnimatedArmLayers(svg)
    }
    applyCharacterAppearance(svg, JSON.parse(appearanceKey) as CharacterAppearance)
    setSvgGeneration((g) => g + 1)
  }, [appearanceKey, asset])

  useArmPoseAnimation(svgRef, isBody ? armPose : { armL: 0, armR: 0 }, svgGeneration)
  useCharacterBlink(svgRef, isBody ? svgGeneration : -1)

  const viewBox =
    asset === 'headshot' ? charManifest.headshotViewBox : charManifest.viewBox
  const [, , vbW, vbH] = viewBox.split(/\s+/).map(Number)

  return (
    <div
      className={`overflow-visible ${className ?? ''}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <div
        ref={hostRef}
        className="h-full w-full overflow-visible [&_svg]:mx-auto [&_svg]:block [&_svg]:h-full [&_svg]:w-full [&_svg]:max-h-full"
        style={vbW && vbH ? { aspectRatio: `${vbW} / ${vbH}` } : undefined}
      />
    </div>
  )
}

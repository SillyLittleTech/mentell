import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import charSvg from '../../../asset/char/charprod.svg?raw'
import headshotSvg from '../../../asset/char/headshot.svg?raw'
import { applyCharacterAppearance } from './applyCharacterAppearance'
import {
  fixCharacterPaintOrder,
  fixHeadshotPaintOrder,
} from './characterPaintOrder'
import { charManifest } from './charManifest'
import {
  defaultCharacterAppearance,
  type CharacterAppearance,
} from './characterAppearance'
import type { CharacterPoseId } from './charManifest'
import { CHARACTER_POSES } from './characterPoses'
import { useCharacterBlink } from './characterBlink'
import { useArmPoseAnimation } from './useArmPoseAnimation'
import { usePetAccessoryAnimation } from './usePetAccessoryAnimation'
import { useCharacterAppearance } from './useCharacterAppearance'
import { useEquippedCharacterAccessories } from '../shop/shopCharacterAccessories'
import type { CharacterAccessoryItem } from '../shop/shopCatalog'

const DEFAULT_APPEARANCE = defaultCharacterAppearance()

const SVG_SOURCE = {
  character: charSvg,
  headshot: headshotSvg,
} as const

let nextPaintServerInstanceId = 0

function namespaceSvgPaintServers(svg: SVGSVGElement) {
  nextPaintServerInstanceId += 1
  const suffix = `mentell-svg-${nextPaintServerInstanceId}`
  const idMap = new Map<string, string>()
  svg.querySelectorAll<SVGElement>('defs [id]').forEach((el) => {
    const id = el.id
    if (!id) return
    const nextId = `${id}-${suffix}`
    idMap.set(id, nextId)
    el.id = nextId
  })
  if (!idMap.size) return

  const replaceRefs = (value: string) =>
    value
      .replace(/url\(#([^)]+)\)/g, (match, id: string) => {
        const nextId = idMap.get(id)
        return nextId ? `url(#${nextId})` : match
      })
      .replace(/^#(.+)$/, (match, id: string) => {
        const nextId = idMap.get(id)
        return nextId ? `#${nextId}` : match
      })

  svg.querySelectorAll<SVGElement>('*').forEach((el) => {
    for (const attr of ['style', 'fill', 'stroke', 'filter', 'href', 'xlink:href']) {
      const value = el.getAttribute(attr)
      if (!value) continue
      const nextValue = replaceRefs(value)
      if (nextValue !== value) el.setAttribute(attr, nextValue)
    }
  })
}

export type CharacterAsset = keyof typeof SVG_SOURCE

export type MentellCharacterProps = {
  pose: CharacterPoseId
  asset?: CharacterAsset
  appearance?: CharacterAppearance
  className?: string
  title?: string
  characterAccessories?: CharacterAccessoryItem[]
}

export function MentellCharacter({
  pose,
  asset = 'character',
  appearance: appearanceProp,
  className,
  title,
  characterAccessories,
}: MentellCharacterProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const [svgGeneration, setSvgGeneration] = useState(0)
  const { appearance: storedAppearance } = useCharacterAppearance()
  const equippedAccessories = useEquippedCharacterAccessories(characterAccessories === undefined)
  const accessories = characterAccessories ?? equippedAccessories
  const appearance = appearanceProp ?? storedAppearance ?? DEFAULT_APPEARANCE
  const appearanceKey = JSON.stringify(appearance)
  const accessoryKey = JSON.stringify(accessories.map((item) => item.id))
  const armPose = CHARACTER_POSES[pose]
  const isBody = asset === 'character'
  const anchoredIds = useMemo(
    () => ({
      armL: accessories.flatMap((item) => item.characterAccessory.anchoredIds?.armL ?? []),
      armR: accessories.flatMap((item) => item.characterAccessory.anchoredIds?.armR ?? []),
    }),
    [accessories],
  )

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    const doc = new DOMParser().parseFromString(SVG_SOURCE[asset], 'image/svg+xml')
    const parsed = doc.documentElement
    if (parsed.nodeName.toLowerCase() === 'parsererror') return
    const svg = parsed as unknown as SVGSVGElement
    host.replaceChildren(svg)
    svgRef.current = svg
    svg.setAttribute('width', '100%')
    svg.setAttribute('height', '100%')
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
    svg.style.display = 'block'
    svg.style.overflow = asset === 'headshot' ? 'hidden' : 'visible'
    if (asset === 'character') {
      fixCharacterPaintOrder(svg)
    } else {
      fixHeadshotPaintOrder(svg)
    }
    namespaceSvgPaintServers(svg)
    applyCharacterAppearance(svg, appearance, accessories)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSvgGeneration((g) => g + 1)
  }, [appearance, appearanceKey, accessories, accessoryKey, asset])

  useArmPoseAnimation(
    svgRef,
    isBody ? armPose : { armL: 0, armR: 0 },
    svgGeneration,
    anchoredIds,
  )
  useCharacterBlink(svgRef, isBody ? svgGeneration : -1)
  usePetAccessoryAnimation(svgRef, isBody ? svgGeneration : -1)

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

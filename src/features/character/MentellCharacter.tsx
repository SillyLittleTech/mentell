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
import { useCharacterPetReaction } from './useCharacterPetReaction'
import { CharacterPetHearts } from './CharacterPetHearts'
import { useCharacterAppearance } from './useCharacterAppearance'
import { useEquippedCharacterAccessories } from '../shop/shopCharacterAccessories'
import type { CharacterAccessoryItem } from '../shop/shopCatalog'

const DEFAULT_APPEARANCE = defaultCharacterAppearance()
const PET_DEBOUNCE_MS = 500

const SVG_SOURCE = {
  character: charSvg,
  headshot: headshotSvg,
} as const

export type CharacterAsset = keyof typeof SVG_SOURCE

const svgTemplateCache = new Map<string, SVGSVGElement>()
let nextPaintServerInstanceId = 0

function parsedAssetTemplate(asset: CharacterAsset): SVGSVGElement | null {
  const cacheKey = `${asset}:raw`
  let template = svgTemplateCache.get(cacheKey)
  if (template) return template
  const doc = new DOMParser().parseFromString(SVG_SOURCE[asset], 'image/svg+xml')
  const parsed = doc.documentElement
  if (parsed.nodeName.toLowerCase() === 'parsererror') return null
  template = parsed as unknown as SVGSVGElement
  svgTemplateCache.set(cacheKey, template)
  return template
}

function cloneAssetSvg(asset: CharacterAsset, staticPreview: boolean): SVGSVGElement | null {
  const cacheKey = staticPreview ? `${asset}:preview` : `${asset}:live`
  let template = svgTemplateCache.get(cacheKey)
  if (!template) {
    const raw = parsedAssetTemplate(asset)
    if (!raw) return null
    template = raw.cloneNode(true) as SVGSVGElement
    if (staticPreview) lightenSvgForPreview(template)
    else if (asset === 'character') stripFiltersFromAnimatedLayers(template)
    svgTemplateCache.set(cacheKey, template)
  }
  return template.cloneNode(true) as SVGSVGElement
}

const FILTER_STYLE_RE = /(?:^|;)\s*filter\s*:[^;]*/gi
const BLEND_STYLE_RE = /mix-blend-mode\s*:\s*[^;]+/gi
const PAINT_REF_SELECTOR =
  '[style*="url("], [fill*="url("], [stroke*="url("], [filter], [href^="#"], [xlink\\:href^="#"]'

function stripFilterFromElement(el: Element) {
  el.removeAttribute('filter')
  const style = el.getAttribute('style')
  if (!style?.includes('filter')) return
  el.setAttribute('style', style.replace(FILTER_STYLE_RE, '').replace(/^;|;$/g, ''))
}

function lightenSvgForPreview(svg: SVGSVGElement) {
  svg.querySelectorAll('filter').forEach((el) => el.remove())
  svg.querySelectorAll('[filter], [style*="filter"]').forEach(stripFilterFromElement)
  svg.querySelectorAll('[style*="mix-blend-mode"]').forEach((el) => {
    const style = el.getAttribute('style')
    if (!style) return
    el.setAttribute('style', style.replace(BLEND_STYLE_RE, 'mix-blend-mode:normal'))
  })
  for (const label of ['baseShadowModel', 'armShadowModel']) {
    svg.querySelectorAll('g').forEach((el) => {
      if (el.getAttribute('inkscape:label') === label && el instanceof SVGElement) {
        el.style.display = 'none'
      }
    })
  }
}

function isInsideShadowModel(el: Element) {
  let node: Element | null = el
  while (node) {
    const label = node.getAttribute('inkscape:label') ?? ''
    if (label.endsWith('ShadowModel')) return true
    node = node.parentElement
  }
  return false
}

function stripFiltersFromAnimatedLayers(svg: SVGSVGElement) {
  const roots: (Element | null)[] = [svg.getElementById('layer19')]
  svg.querySelectorAll('g').forEach((el) => {
    const label = el.getAttribute('inkscape:label') ?? ''
    if (label !== 'armL_joint' && label !== 'armR_joint') return
    if (isInsideShadowModel(el)) return
    roots.push(el)
  })
  for (const root of roots) {
    if (!root) continue
    stripFilterFromElement(root)
    root.querySelectorAll('[style*="filter"], [filter]').forEach((el) => {
      const label = el.getAttribute('inkscape:label') ?? ''
      if (label.startsWith('armSgen')) return
      stripFilterFromElement(el)
    })
  }
}

const XLINK_NS = 'http://www.w3.org/1999/xlink'

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

  svg.querySelectorAll<SVGElement>(PAINT_REF_SELECTOR).forEach((el) => {
    for (const attr of ['style', 'fill', 'stroke', 'filter', 'href']) {
      const value = el.getAttribute(attr)
      if (!value || (!value.includes('url(') && !value.startsWith('#'))) continue
      const nextValue = replaceRefs(value)
      if (nextValue !== value) el.setAttribute(attr, nextValue)
    }
  })

  svg.querySelectorAll('linearGradient, radialGradient, pattern, filter, use').forEach((el) => {
    if (!(el instanceof SVGElement)) return
    const href = el.getAttribute('href') ?? el.getAttributeNS(XLINK_NS, 'href')
    if (!href?.startsWith('#')) return
    const nextId = idMap.get(href.slice(1))
    if (!nextId) return
    el.setAttribute('href', `#${nextId}`)
    el.setAttributeNS(XLINK_NS, 'href', `#${nextId}`)
  })
}

export type MentellCharacterProps = {
  pose: CharacterPoseId
  asset?: CharacterAsset
  appearance?: CharacterAppearance
  className?: string
  title?: string
  characterAccessories?: CharacterAccessoryItem[]
  closeEyesOnInteract?: boolean
  pettable?: boolean
  /** Skip blink/pose/pet loops — for dense grids like Shoppe cards. */
  staticPreview?: boolean
}

export function MentellCharacter({
  pose,
  asset = 'character',
  appearance: appearanceProp,
  className,
  title,
  characterAccessories,
  closeEyesOnInteract = false,
  pettable = false,
  staticPreview = false,
}: MentellCharacterProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const lastPetAt = useRef(0)
  const [forceClosedEyes, setForceClosedEyes] = useState(false)
  const [petBurst, setPetBurst] = useState(0)
  const { appearance: storedAppearance } = useCharacterAppearance()
  const equippedAccessories = useEquippedCharacterAccessories(characterAccessories === undefined)
  const accessories = characterAccessories ?? equippedAccessories
  const appearance = appearanceProp ?? storedAppearance ?? DEFAULT_APPEARANCE
  const appearanceKey = JSON.stringify(appearance)
  const accessoryKey = JSON.stringify(accessories.map((item) => item.id))
  const svgGeneration = `${asset}|${accessoryKey}`
  const armPose = CHARACTER_POSES[pose]
  const isBody = asset === 'character'
  const live = isBody && !staticPreview
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
    const svg = cloneAssetSvg(asset, staticPreview)
    if (!svg) return
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
  }, [asset, staticPreview])

  useLayoutEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    applyCharacterAppearance(svg, appearance, accessories)
  }, [appearance, appearanceKey, accessories, accessoryKey, asset, staticPreview])

  useArmPoseAnimation(
    svgRef,
    live ? armPose : { armL: 0, armR: 0 },
    live ? svgGeneration : -1,
    anchoredIds,
  )
  useCharacterBlink(svgRef, live ? svgGeneration : -1, live && closeEyesOnInteract && forceClosedEyes)
  usePetAccessoryAnimation(svgRef, live ? svgGeneration : -1)
  useCharacterPetReaction(svgRef, live ? svgGeneration : -1, pettable && !staticPreview ? petBurst : 0)

  const viewBox =
    asset === 'headshot' ? charManifest.headshotViewBox : charManifest.viewBox
  const [, , vbW, vbH] = viewBox.split(/\s+/).map(Number)

  function handlePointerUp() {
    if (closeEyesOnInteract) setForceClosedEyes(false)
    if (!pettable || !isBody) return
    const now = performance.now()
    if (now - lastPetAt.current < PET_DEBOUNCE_MS) return
    lastPetAt.current = now
    setPetBurst((n) => n + 1)
  }

  return (
    <div
      className={`relative overflow-visible ${pettable ? 'cursor-pointer' : ''} ${className ?? ''}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      onPointerEnter={closeEyesOnInteract ? () => setForceClosedEyes(true) : undefined}
      onPointerLeave={closeEyesOnInteract ? () => setForceClosedEyes(false) : undefined}
      onPointerDown={closeEyesOnInteract || pettable ? () => setForceClosedEyes(closeEyesOnInteract) : undefined}
      onPointerUp={closeEyesOnInteract || pettable ? handlePointerUp : undefined}
      onPointerCancel={closeEyesOnInteract ? () => setForceClosedEyes(false) : undefined}
    >
      <div
        ref={hostRef}
        className="h-full w-full overflow-visible [&_svg]:mx-auto [&_svg]:block [&_svg]:h-full [&_svg]:w-full [&_svg]:max-h-full"
        style={vbW && vbH ? { aspectRatio: `${vbW} / ${vbH}` } : undefined}
      />
      {pettable ? <CharacterPetHearts burst={petBurst} /> : null}
    </div>
  )
}

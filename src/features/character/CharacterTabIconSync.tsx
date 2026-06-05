import { useEffect } from 'react'
import headshotSvg from '../../../asset/char/headshot.svg?raw'
import { applyCharacterAppearance } from './applyCharacterAppearance'
import { defaultCharacterAppearance } from './characterAppearance'
import { fixHeadshotPaintOrder } from './characterPaintOrder'
import { useCharacterAppearance } from './useCharacterAppearance'

const FAVICON_SIZE = '96'
// Crops the generated headshot so hair toggles do not shift icon framing.
const FAVICON_HEAD_VIEWBOX = '16 4 68 74'

function buildCharacterFaviconDataUrl(appearance: ReturnType<typeof defaultCharacterAppearance>) {
  const parsed = new DOMParser().parseFromString(headshotSvg, 'image/svg+xml')
  const svg = parsed.querySelector('svg')
  if (!(svg instanceof SVGSVGElement)) return null
  svg.setAttribute('width', FAVICON_SIZE)
  svg.setAttribute('height', FAVICON_SIZE)
  svg.setAttribute('viewBox', FAVICON_HEAD_VIEWBOX)
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
  fixHeadshotPaintOrder(svg)
  applyCharacterAppearance(svg, appearance)
  const serialized = new XMLSerializer().serializeToString(svg)
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`
}

function ensureFaviconLink(): HTMLLinkElement {
  const existing = document.querySelector<HTMLLinkElement>(
    'link[rel="icon"], link[rel="shortcut icon"]',
  )
  if (existing) return existing
  const created = document.createElement('link')
  created.rel = 'icon'
  document.head.appendChild(created)
  return created
}

export function CharacterTabIconSync() {
  const { appearance, ready } = useCharacterAppearance()

  useEffect(() => {
    if (!ready) return
    const favicon = ensureFaviconLink()
    const dataUrl = buildCharacterFaviconDataUrl(appearance)
    if (!dataUrl) return
    favicon.type = 'image/svg+xml'
    favicon.href = dataUrl
  }, [appearance, ready])

  return null
}

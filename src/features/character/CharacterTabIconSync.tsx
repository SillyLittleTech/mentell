import { useEffect } from 'react'
import headshotSvg from '../../../asset/char/headshot.svg?raw'
import { applyCharacterAppearance } from './applyCharacterAppearance'
import { defaultCharacterAppearance } from './characterAppearance'
import { useCharacterAppearance } from './useCharacterAppearance'

function buildCharacterFaviconDataUrl(appearance: ReturnType<typeof defaultCharacterAppearance>) {
  const parsed = new DOMParser().parseFromString(headshotSvg, 'image/svg+xml')
  const svg = parsed.querySelector('svg')
  if (!(svg instanceof SVGSVGElement)) return null
  svg.setAttribute('width', '96')
  svg.setAttribute('height', '96')
  svg.setAttribute('viewBox', '0 0 100 100')
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

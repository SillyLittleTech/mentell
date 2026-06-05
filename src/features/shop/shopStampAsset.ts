import { useEffect, useMemo, useState } from 'react'
import stampTemplateSvg from '../../../asset/shop/stamp.svg?raw'
import { loadShopCatalog, type StampItem } from './shopCatalog'
import { loadShopInventory, subscribeShopInventory, type ShopInventory } from './shopInventory'

const DEFAULT_STAMP_TEXT = 'STAMP'
const DEFAULT_STAMP_INK = '#c61d1d'
const DEFAULT_STAMP_OUTLINE = '#9e1717'
const DEFAULT_STAMP_TEXT_COLOR = '#9e1717'
const DEFAULT_STAMP_SRC = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(stampTemplateSvg)}`
const DEFAULT_STAMP_ROTATION = -12
const DEFAULT_STAMP_OPACITY = 0.88

export type EquippedStampAsset = {
  src: string
  isCustom: boolean
  text: string
  ink: string
  outline: string
  textColor: string
}

function serializeSvgElement(svg: SVGSVGElement) {
  const raw = new XMLSerializer().serializeToString(svg)
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(raw)}`
}

function clampNumber(value: number | undefined, fallback: number, min: number, max: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value as number))
}

function normalizedStampText(value: string) {
  const clean = value.replace(/\s+/g, ' ').trim().toUpperCase()
  if (!clean) return DEFAULT_STAMP_TEXT
  return clean.slice(0, 20)
}

function escapeXmlText(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function svgElementById(doc: Document, id: string) {
  const el = doc.getElementById(id)
  return el instanceof SVGElement ? el : null
}

function renderSimpleStampDataUri(item: StampItem): string {
  const text = escapeXmlText(normalizedStampText(item.stamp.text))
  const textColor = item.stamp.textColor ?? item.stamp.outline
  const tilt = clampNumber(item.stamp.tiltDeg, DEFAULT_STAMP_ROTATION, -36, 36)
  const opacity = clampNumber(item.stamp.opacity, DEFAULT_STAMP_OPACITY, 0.32, 1)
  const viewBox = '0 0 256 256'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="256" height="256" aria-hidden="true"><g transform="rotate(${tilt} 128 128)" opacity="${opacity}"><rect x="36" y="58" width="184" height="140" rx="26" ry="26" fill="none" stroke="${item.stamp.outline}" stroke-width="12"/><rect x="50" y="72" width="156" height="112" rx="18" ry="18" fill="none" stroke="${item.stamp.ink}" stroke-width="6" stroke-dasharray="9 8"/><text x="128" y="139" text-anchor="middle" dominant-baseline="middle" fill="${textColor}" font-family="Rockwell, ui-serif, serif" font-weight="700" font-size="54" letter-spacing="2.8">${text}</text></g></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function renderLegacyTemplateDataUri(item: StampItem, doc: Document): string {
  const svg = doc.documentElement
  if (!(svg instanceof SVGSVGElement)) return renderSimpleStampDataUri(item)

  const stampRoot = svgElementById(doc, 'stamp-root')
  const border = svgElementById(doc, 'stamp-border')
  const inner = svgElementById(doc, 'stamp-inner')
  const text = svgElementById(doc, 'stamp-text')
  const tilt = clampNumber(item.stamp.tiltDeg, DEFAULT_STAMP_ROTATION, -36, 36)
  const opacity = clampNumber(item.stamp.opacity, DEFAULT_STAMP_OPACITY, 0.32, 1)

  if (stampRoot) {
    stampRoot.setAttribute('transform', `rotate(${tilt} 128 128)`)
    stampRoot.style.opacity = String(opacity)
  }
  if (border) {
    border.style.stroke = item.stamp.outline
    border.style.fill = 'none'
  }
  if (inner) {
    inner.style.stroke = item.stamp.ink
    inner.style.fill = 'none'
    inner.style.strokeDasharray = '8 7'
  }
  if (text) {
    text.style.fill = item.stamp.textColor ?? item.stamp.outline
    text.setAttribute('font-size', '84')
    text.setAttribute('letter-spacing', '2.8')
    text.textContent = normalizedStampText(item.stamp.text)
  }
  return serializeSvgElement(svg)
}

function renderStampDataUri(item: StampItem): string {
  const doc = new DOMParser().parseFromString(stampTemplateSvg, 'image/svg+xml')
  const svg = doc.documentElement
  if (!(svg instanceof SVGSVGElement)) return renderSimpleStampDataUri(item)

  const hasLegacyTargets = Boolean(
    svgElementById(doc, 'stamp-root') &&
      svgElementById(doc, 'stamp-border') &&
      svgElementById(doc, 'stamp-inner') &&
      svgElementById(doc, 'stamp-text'),
  )
  if (hasLegacyTargets) return renderLegacyTemplateDataUri(item, doc)
  return renderSimpleStampDataUri(item)
}

function findEquippedStamp(inventory: ShopInventory): StampItem | null {
  const stampId = inventory.equipped.stampId
  if (!stampId) return null
  const item = loadShopCatalog().items.find((entry) => entry.id === stampId && entry.type === 'stamp')
  return (item as StampItem | undefined) ?? null
}

export function renderStampPreviewForItem(item: StampItem) {
  return renderStampDataUri(item)
}

export function useEquippedStampAsset(): EquippedStampAsset {
  const [inventory, setInventory] = useState<ShopInventory>(() => loadShopInventory())
  useEffect(() => subscribeShopInventory((next) => setInventory(next)), [])
  return useMemo(() => {
    const equipped = findEquippedStamp(inventory)
    if (!equipped) {
      return {
        src: DEFAULT_STAMP_SRC,
        isCustom: false,
        text: DEFAULT_STAMP_TEXT,
        ink: DEFAULT_STAMP_INK,
        outline: DEFAULT_STAMP_OUTLINE,
        textColor: DEFAULT_STAMP_TEXT_COLOR,
      }
    }
    return {
      src: renderStampDataUri(equipped),
      isCustom: true,
      text: normalizedStampText(equipped.stamp.text),
      ink: equipped.stamp.ink,
      outline: equipped.stamp.outline,
      textColor: equipped.stamp.textColor ?? equipped.stamp.outline,
    }
  }, [inventory])
}

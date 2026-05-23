import { useEffect, useMemo, useState } from 'react'
import stampTemplateSvg from '../../../asset/shop/stamp.svg?raw'
import { publicUrl } from '../../shared/publicUrl'
import { loadShopCatalog, type StampItem } from './shopCatalog'
import { loadShopInventory, subscribeShopInventory, type ShopInventory } from './shopInventory'

const FALLBACK_STAMP = publicUrl('/asset/stamp.png')
const DEFAULT_STAMP_TEXT = 'STAMP'
const DEFAULT_STAMP_INK = '#c61d1d'
const DEFAULT_STAMP_OUTLINE = '#9e1717'
const DEFAULT_STAMP_TEXT_COLOR = '#9e1717'

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

function svgElementById(doc: Document, id: string) {
  const el = doc.getElementById(id)
  return el instanceof SVGElement ? el : null
}

function renderStampDataUri(item: StampItem): string {
  const doc = new DOMParser().parseFromString(stampTemplateSvg, 'image/svg+xml')
  const svg = doc.documentElement
  if (!(svg instanceof SVGSVGElement)) return FALLBACK_STAMP
  const stampRoot = svgElementById(doc, 'stamp-root')
  const border = svgElementById(doc, 'stamp-border')
  const inner = svgElementById(doc, 'stamp-inner')
  const text = svgElementById(doc, 'stamp-text')

  if (stampRoot) {
    const tilt = Number.isFinite(item.stamp.tiltDeg) ? item.stamp.tiltDeg : -14
    stampRoot.setAttribute('transform', `rotate(${tilt} 128 128)`)
    stampRoot.style.opacity = String(
      Number.isFinite(item.stamp.opacity) ? item.stamp.opacity : 0.9,
    )
  }
  if (border) {
    border.setAttribute('stroke', item.stamp.outline)
    border.setAttribute('fill', item.stamp.ink)
    border.style.opacity = '0.34'
  }
  if (inner) {
    inner.setAttribute('stroke', item.stamp.outline)
    inner.setAttribute('fill', item.stamp.ink)
    inner.style.opacity = '0.2'
  }
  if (text) {
    text.setAttribute('fill', item.stamp.textColor ?? item.stamp.outline)
    text.setAttribute('font-size', '74')
    text.setAttribute('letter-spacing', '2.2')
    text.textContent = item.stamp.text.toUpperCase()
  }
  return serializeSvgElement(svg)
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
        src: FALLBACK_STAMP,
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
      text: equipped.stamp.text.toUpperCase(),
      ink: equipped.stamp.ink,
      outline: equipped.stamp.outline,
      textColor: equipped.stamp.textColor ?? equipped.stamp.outline,
    }
  }, [inventory])
}

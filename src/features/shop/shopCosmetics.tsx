import { useEffect, useMemo, useState } from 'react'
import cursorTemplateSvg from '../../../asset/shop/cursor.svg?raw'
import stampTemplateSvg from '../../../asset/shop/stamp.svg?raw'
import { publicUrl } from '../../shared/publicUrl'
import { useTheme } from '../../shared/theme/useTheme'
import {
  loadShopCatalog,
  type CursorItem,
  type ShopCatalogItem,
  type StampItem,
  type ThemeItem,
} from './shopCatalog'
import {
  loadShopInventory,
  subscribeShopInventory,
  type ShopInventory,
} from './shopInventory'

type CursorContext = 'default' | 'pointer' | 'text'

const FALLBACK_STAMP = publicUrl('/asset/stamp.png')

function findEquippedItem<T extends ShopCatalogItem>(
  items: ShopCatalogItem[],
  itemType: T['type'],
  id: string | null,
): T | null {
  if (!id) return null
  const item = items.find((entry) => entry.id === id && entry.type === itemType)
  return (item as T | undefined) ?? null
}

function serializeSvgElement(svg: SVGSVGElement) {
  const raw = new XMLSerializer().serializeToString(svg)
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(raw)}`
}

function setThemeCssVar(name: string, value?: string) {
  if (value) document.documentElement.style.setProperty(name, value)
  else document.documentElement.style.removeProperty(name)
}

function applyThemeCosmetics(mode: 'light' | 'dark', themeItem: ThemeItem | null) {
  if (!themeItem) {
    setThemeCssVar('--desk-bg')
    setThemeCssVar('--paper-bg')
    setThemeCssVar('--paper-border')
    setThemeCssVar('--accent')
    setThemeCssVar('--shop-theme-overlay')
    return
  }
  const palette = mode === 'dark' ? themeItem.theme.dark : themeItem.theme.light
  setThemeCssVar('--desk-bg', palette.deskBg)
  setThemeCssVar('--paper-bg', palette.paperBg)
  setThemeCssVar('--paper-border', palette.paperBorder)
  setThemeCssVar('--accent', palette.accent)
  setThemeCssVar('--shop-theme-overlay', palette.overlay)
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
      Number.isFinite(item.stamp.opacity) ? item.stamp.opacity : 0.24,
    )
  }
  if (border) {
    border.setAttribute('stroke', item.stamp.outline)
    border.setAttribute('fill', item.stamp.ink)
    border.style.opacity = '0.08'
  }
  if (inner) {
    inner.setAttribute('stroke', item.stamp.outline)
  }
  if (text) {
    text.setAttribute('fill', item.stamp.textColor ?? item.stamp.outline)
    text.textContent = item.stamp.text
  }
  return serializeSvgElement(svg)
}

function renderCursorCssValue(item: CursorItem, context: CursorContext): string | null {
  const doc = new DOMParser().parseFromString(cursorTemplateSvg, 'image/svg+xml')
  const svg = doc.documentElement
  if (!(svg instanceof SVGSVGElement)) return null

  const contextLayers = svg.querySelectorAll<SVGGElement>('g[data-context]')
  contextLayers.forEach((layer) => {
    const active = layer.dataset.context === context
    layer.style.display = active ? 'inline' : 'none'
  })

  const fills = svg.querySelectorAll<SVGElement>('[data-fill]')
  fills.forEach((el) => {
    const role = el.dataset.fill
    if (role === 'primary') el.setAttribute('fill', item.cursor.primary)
    if (role === 'secondary') el.setAttribute('fill', item.cursor.secondary)
    if (role === 'outline') el.setAttribute('fill', item.cursor.outline)
    if (role === 'text') el.setAttribute('fill', item.cursor.textPrimary ?? item.cursor.primary)
  })

  const strokes = svg.querySelectorAll<SVGElement>('[data-stroke]')
  strokes.forEach((el) => {
    const role = el.dataset.stroke
    if (role === 'outline') el.setAttribute('stroke', item.cursor.outline)
    if (role === 'primary') el.setAttribute('stroke', item.cursor.primary)
  })

  const hotspot = item.cursor.hotspot?.[context]
  const defaultHotspot: Record<CursorContext, [number, number]> = {
    default: [3, 3],
    pointer: [4, 2],
    text: [8, 14],
  }
  const [hx, hy] = hotspot ?? defaultHotspot[context]
  return `url("${serializeSvgElement(svg)}") ${hx} ${hy}, auto`
}

function applyCursorCosmetics(cursorItem: CursorItem | null) {
  if (!cursorItem) {
    document.documentElement.style.removeProperty('--shop-cursor-default')
    document.documentElement.style.removeProperty('--shop-cursor-pointer')
    document.documentElement.style.removeProperty('--shop-cursor-text')
    return
  }
  const base = renderCursorCssValue(cursorItem, 'default')
  const pointer = renderCursorCssValue(cursorItem, 'pointer')
  const text = renderCursorCssValue(cursorItem, 'text')
  if (base) document.documentElement.style.setProperty('--shop-cursor-default', base)
  if (pointer) document.documentElement.style.setProperty('--shop-cursor-pointer', pointer)
  if (text) document.documentElement.style.setProperty('--shop-cursor-text', text)
}

export function useShopInventoryState() {
  const [inventory, setInventory] = useState<ShopInventory>(() => loadShopInventory())
  useEffect(() => subscribeShopInventory((next) => setInventory(next)), [])
  return inventory
}

export function useShopCatalogState() {
  return useMemo(() => loadShopCatalog(), [])
}

export function isOwned(inventory: ShopInventory, itemId: string) {
  return inventory.ownedItemIds.includes(itemId)
}

export function useEquippedStampImage() {
  const catalog = useShopCatalogState()
  const inventory = useShopInventoryState()
  return useMemo(() => {
    const stamp = findEquippedItem<StampItem>(catalog.items, 'stamp', inventory.equipped.stampId)
    return stamp ? renderStampDataUri(stamp) : FALLBACK_STAMP
  }, [catalog.items, inventory.equipped.stampId])
}

export function ShopCosmeticEffects() {
  const { mode } = useTheme()
  const catalog = useShopCatalogState()
  const inventory = useShopInventoryState()
  const equippedTheme = useMemo(
    () => findEquippedItem<ThemeItem>(catalog.items, 'theme', inventory.equipped.themeId),
    [catalog.items, inventory.equipped.themeId],
  )
  const equippedCursor = useMemo(
    () => findEquippedItem<CursorItem>(catalog.items, 'cursor', inventory.equipped.cursorId),
    [catalog.items, inventory.equipped.cursorId],
  )

  useEffect(() => {
    applyThemeCosmetics(mode, equippedTheme)
  }, [mode, equippedTheme])

  useEffect(() => {
    applyCursorCosmetics(equippedCursor)
  }, [equippedCursor])

  return null
}

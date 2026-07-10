import { useEffect, useMemo, useState } from 'react'
import { useTheme } from '../../shared/theme/useTheme'
import {
  loadShopCatalog,
  type CursorItem,
  type ShopCatalogItem,
  type ThemeItem,
} from './shopCatalog'
import { renderCursorCssValue } from './shopCursorAsset'
import {
  loadShopInventory,
  subscribeShopInventory,
  type ShopInventory,
} from './shopInventory'

function findEquippedItem<T extends ShopCatalogItem>(
  items: ShopCatalogItem[],
  itemType: T['type'],
  id: string | null,
): T | null {
  if (!id) return null
  const item = items.find((entry) => entry.id === id && entry.type === itemType)
  return (item as T | undefined) ?? null
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
    setThemeCssVar('--primary-action')
    setThemeCssVar('--shop-theme-overlay')
    return
  }
  const palette = mode === 'dark' ? themeItem.theme.dark : themeItem.theme.light
  setThemeCssVar('--desk-bg', palette.deskBg)
  setThemeCssVar('--paper-bg', palette.paperBg)
  setThemeCssVar('--paper-border', palette.paperBorder)
  setThemeCssVar('--accent', palette.accent)
  setThemeCssVar('--primary-action', palette.accent)
  setThemeCssVar('--shop-theme-overlay', palette.overlay)
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

function useShopInventoryState() {
  const [inventory, setInventory] = useState<ShopInventory>(() => loadShopInventory())
  useEffect(() => subscribeShopInventory((next) => setInventory(next)), [])
  return inventory
}

function useShopCatalogState() {
  return useMemo(() => loadShopCatalog(), [])
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

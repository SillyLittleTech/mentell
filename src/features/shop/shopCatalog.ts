import catalogJson from '../../../asset/shop/shoppe-items.json?raw'

export type ShopItemType = 'image' | 'theme' | 'stamp' | 'cursor'

type ShopItemBase = {
  id: string
  type: ShopItemType
  name: string
  description: string
  cost: number
  preview?: string
}

export type ThemePalette = {
  deskBg: string
  paperBg?: string
  paperBorder?: string
  accent?: string
  overlay?: string
}

export type ThemeItem = ShopItemBase & {
  type: 'theme'
  theme: {
    light: ThemePalette
    dark: ThemePalette
  }
}

export type StampItem = ShopItemBase & {
  type: 'stamp'
  stamp: {
    text: string
    ink: string
    outline: string
    textColor?: string
    tiltDeg?: number
    opacity?: number
  }
}

export type CursorItem = ShopItemBase & {
  type: 'cursor'
  cursor: {
    primary: string
    secondary: string
    outline: string
    textPrimary?: string
    hotspot?: {
      default?: [number, number]
      pointer?: [number, number]
      text?: [number, number]
    }
  }
}

export type ImageItem = ShopItemBase & {
  type: 'image'
  image: {
    url: string
  }
}

export type ShopCatalogItem = ThemeItem | StampItem | CursorItem | ImageItem

export type ShopCatalog = {
  version: number
  items: ShopCatalogItem[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asTuple(value: unknown): [number, number] | undefined {
  if (!Array.isArray(value) || value.length !== 2) return undefined
  const first = Number(value[0])
  const second = Number(value[1])
  if (!Number.isFinite(first) || !Number.isFinite(second)) return undefined
  return [Math.trunc(first), Math.trunc(second)]
}

function parseThemePalette(value: unknown): ThemePalette {
  const row = asRecord(value)
  if (!row) return { deskBg: '' }
  return {
    deskBg: asString(row.deskBg),
    paperBg: asString(row.paperBg) || undefined,
    paperBorder: asString(row.paperBorder) || undefined,
    accent: asString(row.accent) || undefined,
    overlay: asString(row.overlay) || undefined,
  }
}

function parseItem(value: unknown): ShopCatalogItem | null {
  const row = asRecord(value)
  if (!row) return null
  const type = asString(row.type) as ShopItemType
  const base: ShopItemBase = {
    id: asString(row.id),
    type,
    name: asString(row.name),
    description: asString(row.description),
    cost: Math.max(0, Math.trunc(asNumber(row.cost))),
    preview: asString(row.preview) || undefined,
  }
  if (!base.id || !base.name || !base.description) return null
  if (type === 'theme') {
    const theme = asRecord(row.theme)
    if (!theme) return null
    const parsed: ThemeItem = {
      ...base,
      type: 'theme',
      theme: {
        light: parseThemePalette(theme.light),
        dark: parseThemePalette(theme.dark),
      },
    }
    if (!parsed.theme.light.deskBg || !parsed.theme.dark.deskBg) return null
    return parsed
  }
  if (type === 'stamp') {
    const stamp = asRecord(row.stamp)
    if (!stamp) return null
    const parsed: StampItem = {
      ...base,
      type: 'stamp',
      stamp: {
        text: asString(stamp.text),
        ink: asString(stamp.ink),
        outline: asString(stamp.outline),
        textColor: asString(stamp.textColor) || undefined,
        tiltDeg: asNumber(stamp.tiltDeg),
        opacity: asNumber(stamp.opacity),
      },
    }
    if (!parsed.stamp.text || !parsed.stamp.ink || !parsed.stamp.outline) return null
    return parsed
  }
  if (type === 'cursor') {
    const cursor = asRecord(row.cursor)
    if (!cursor) return null
    const hotspot = asRecord(cursor.hotspot)
    const parsed: CursorItem = {
      ...base,
      type: 'cursor',
      cursor: {
        primary: asString(cursor.primary),
        secondary: asString(cursor.secondary),
        outline: asString(cursor.outline),
        textPrimary: asString(cursor.textPrimary) || undefined,
        hotspot: {
          default: asTuple(hotspot?.default),
          pointer: asTuple(hotspot?.pointer),
          text: asTuple(hotspot?.text),
        },
      },
    }
    if (!parsed.cursor.primary || !parsed.cursor.secondary || !parsed.cursor.outline) return null
    return parsed
  }
  if (type === 'image') {
    const image = asRecord(row.image)
    if (!image) return null
    const parsed: ImageItem = {
      ...base,
      type: 'image',
      image: { url: asString(image.url) },
    }
    if (!parsed.image.url) return null
    return parsed
  }
  return null
}

let catalogCache: ShopCatalog | null = null

export function loadShopCatalog(): ShopCatalog {
  if (catalogCache) return catalogCache
  let parsed: unknown
  try {
    parsed = JSON.parse(catalogJson)
  } catch {
    catalogCache = { version: 1, items: [] }
    return catalogCache
  }
  const root = asRecord(parsed)
  const rawItems = Array.isArray(root?.items) ? root.items : []
  const items = rawItems.map(parseItem).filter((row): row is ShopCatalogItem => row !== null)
  catalogCache = {
    version: Math.max(1, Math.trunc(asNumber(root?.version, 1))),
    items,
  }
  return catalogCache
}

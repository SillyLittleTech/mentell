import { scopedStorageKey } from '../../shared/storage/storageScope'
import { notifyLocalDataChanged } from '../../shared/sync/localDataEvents'

const SHOP_INVENTORY_KEY = scopedStorageKey('mentell.shop.inventory')
export const SHOP_INVENTORY_CHANGED_EVENT = 'mentell.shop.inventory.changed'

export type EquippedShopItems = {
  themeId: string | null
  stampId: string | null
  cursorId: string | null
  characterAccessoryIds: string[]
  characterAccessoryChoices: Record<string, string>
}

export type ShopInventory = {
  ownedItemIds: string[]
  equipped: EquippedShopItems
  updatedAt: number
}

type WriteOptions = {
  notifySync?: boolean
  preserveUpdatedAt?: boolean
}

const DEFAULT_SHOP_INVENTORY: ShopInventory = {
  ownedItemIds: [],
  equipped: {
    themeId: null,
    stampId: null,
    cursorId: null,
    characterAccessoryIds: [],
    characterAccessoryChoices: {},
  },
  updatedAt: 0,
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function sanitizeInventory(input: unknown): ShopInventory {
  const row = asRecord(input)
  const equippedRow = asRecord(row?.equipped)
  const owned = Array.isArray(row?.ownedItemIds) ? row?.ownedItemIds : []
  const ownedItemIds = [...new Set(owned.filter((id): id is string => typeof id === 'string'))]
  const updatedAtRaw = Number(row?.updatedAt)
  return {
    ownedItemIds,
    equipped: {
      themeId: typeof equippedRow?.themeId === 'string' ? equippedRow.themeId : null,
      stampId: typeof equippedRow?.stampId === 'string' ? equippedRow.stampId : null,
      cursorId: typeof equippedRow?.cursorId === 'string' ? equippedRow.cursorId : null,
      characterAccessoryIds: Array.isArray(equippedRow?.characterAccessoryIds)
        ? [
            ...new Set(
              equippedRow.characterAccessoryIds.filter(
                (id): id is string => typeof id === 'string',
              ),
            ),
          ]
        : [],
      characterAccessoryChoices: Object.fromEntries(
        Object.entries(asRecord(equippedRow?.characterAccessoryChoices) ?? {}).filter(
          (entry): entry is [string, string] =>
            typeof entry[0] === 'string' && typeof entry[1] === 'string',
        ),
      ),
    },
    updatedAt: Number.isFinite(updatedAtRaw) ? Math.max(0, Math.trunc(updatedAtRaw)) : 0,
  }
}

function emitInventoryChanged(next: ShopInventory) {
  window.dispatchEvent(new CustomEvent(SHOP_INVENTORY_CHANGED_EVENT, { detail: next }))
}

function writeInventory(next: ShopInventory, options?: WriteOptions): ShopInventory {
  const notifySync = options?.notifySync ?? true
  const preserveUpdatedAt = options?.preserveUpdatedAt ?? false
  const normalized: ShopInventory = {
    ...next,
    updatedAt: preserveUpdatedAt ? next.updatedAt : Date.now(),
  }
  localStorage.setItem(SHOP_INVENTORY_KEY, JSON.stringify(normalized))
  emitInventoryChanged(normalized)
  if (notifySync) notifyLocalDataChanged()
  return normalized
}

export function loadShopInventory(): ShopInventory {
  try {
    const raw = localStorage.getItem(SHOP_INVENTORY_KEY)
    if (!raw) return { ...DEFAULT_SHOP_INVENTORY }
    return sanitizeInventory(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_SHOP_INVENTORY }
  }
}

export function updateShopInventory(
  updater: (current: ShopInventory) => ShopInventory,
  options?: WriteOptions,
) {
  const current = loadShopInventory()
  const next = sanitizeInventory(updater(current))
  return writeInventory(next, options)
}

export function unlockShopItem(itemId: string) {
  const clean = itemId.trim()
  if (!clean) return loadShopInventory()
  return updateShopInventory((current) => {
    if (current.ownedItemIds.includes(clean)) return current
    return { ...current, ownedItemIds: [...current.ownedItemIds, clean] }
  })
}

export function equipShopItem(kind: 'theme' | 'stamp' | 'cursor', itemId: string | null) {
  const clean = itemId?.trim() || null
  return updateShopInventory((current) => ({
    ...current,
    equipped: {
      ...current.equipped,
      ...(kind === 'theme' ? { themeId: clean } : null),
      ...(kind === 'stamp' ? { stampId: clean } : null),
      ...(kind === 'cursor' ? { cursorId: clean } : null),
    },
  }))
}

export function equipCharacterAccessoryItem(
  itemId: string,
  options?: { exclusiveWith?: string[] },
) {
  const clean = itemId.trim()
  if (!clean) return loadShopInventory()
  const exclusiveWith = new Set(options?.exclusiveWith ?? [])
  return updateShopInventory((current) => {
    const currentlyEquipped = current.equipped.characterAccessoryIds.includes(clean)
    const nextIds = currentlyEquipped
      ? current.equipped.characterAccessoryIds.filter((id) => id !== clean)
      : [
          ...current.equipped.characterAccessoryIds.filter((id) => !exclusiveWith.has(id)),
          clean,
        ]
    return {
      ...current,
      equipped: {
        ...current.equipped,
        characterAccessoryIds: nextIds,
      },
    }
  })
}

export function setCharacterAccessoryChoice(itemId: string, choiceId: string) {
  const cleanItem = itemId.trim()
  const cleanChoice = choiceId.trim()
  if (!cleanItem || !cleanChoice) return loadShopInventory()
  return updateShopInventory((current) => ({
    ...current,
    equipped: {
      ...current.equipped,
      characterAccessoryChoices: {
        ...current.equipped.characterAccessoryChoices,
        [cleanItem]: cleanChoice,
      },
    },
  }))
}

export function applyShopInventoryFromCloud(input: unknown) {
  const parsed = sanitizeInventory(input)
  return writeInventory(parsed, { notifySync: false, preserveUpdatedAt: true })
}

export function clearShopInventory() {
  localStorage.removeItem(SHOP_INVENTORY_KEY)
  const cleared = { ...DEFAULT_SHOP_INVENTORY }
  emitInventoryChanged(cleared)
}

export function subscribeShopInventory(cb: (inventory: ShopInventory) => void) {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<ShopInventory>).detail
    cb(detail ?? loadShopInventory())
  }
  window.addEventListener(SHOP_INVENTORY_CHANGED_EVENT, handler)
  return () => window.removeEventListener(SHOP_INVENTORY_CHANGED_EVENT, handler)
}

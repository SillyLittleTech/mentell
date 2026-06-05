import { useEffect, useMemo, useState } from 'react'
import {
  loadShopCatalog,
  type CharacterAccessoryItem,
  type ShopCatalogItem,
} from './shopCatalog'
import {
  loadShopInventory,
  subscribeShopInventory,
  type ShopInventory,
} from './shopInventory'

function isCharacterAccessory(item: ShopCatalogItem): item is CharacterAccessoryItem {
  return item.type === 'characterAccessory'
}

function accessoryExclusiveKey(item: CharacterAccessoryItem) {
  return (
    item.characterAccessory.exclusiveGroup ??
    item.characterAccessory.toggle?.groupKey ??
    item.characterAccessory.scope
  )
}

export function exclusiveAccessoryIdsFor(
  item: CharacterAccessoryItem,
  items = loadShopCatalog().items,
) {
  const key = accessoryExclusiveKey(item)
  return items
    .filter(isCharacterAccessory)
    .filter((entry) => entry.id !== item.id && accessoryExclusiveKey(entry) === key)
    .map((entry) => entry.id)
}

export function equippedCharacterAccessories(
  inventory: ShopInventory,
  items = loadShopCatalog().items,
) {
  const owned = new Set(inventory.ownedItemIds)
  const equipped = new Set(inventory.equipped.characterAccessoryIds)
  return items
    .filter(isCharacterAccessory)
    .filter((item) => owned.has(item.id) && equipped.has(item.id))
    .map((item) => applyAccessoryChoice(item, inventory))
}

export function accessoryChoiceId(item: CharacterAccessoryItem, inventory: ShopInventory) {
  return (
    inventory.equipped.characterAccessoryChoices[item.id] ??
    item.characterAccessory.defaultChoiceId ??
    item.characterAccessory.choices?.[0]?.id ??
    ''
  )
}

export function applyAccessoryChoice(
  item: CharacterAccessoryItem,
  inventory: ShopInventory,
): CharacterAccessoryItem {
  const choiceId = accessoryChoiceId(item, inventory)
  const choice = item.characterAccessory.choices?.find((entry) => entry.id === choiceId)
  if (!choice) return item
  return {
    ...item,
    characterAccessory: {
      ...item.characterAccessory,
      toggles: choice.toggles?.length ? choice.toggles : item.characterAccessory.toggles,
      parts: choice.parts?.length ? choice.parts : item.characterAccessory.parts,
      anchoredIds: choice.anchoredIds ?? item.characterAccessory.anchoredIds,
    },
  }
}

export function useEquippedCharacterAccessories(enabled = true) {
  const catalog = useMemo(() => loadShopCatalog(), [])
  const [inventory, setInventory] = useState<ShopInventory>(() => loadShopInventory())
  useEffect(() => {
    if (!enabled) return undefined
    return subscribeShopInventory((next) => setInventory(next))
  }, [enabled])
  return useMemo(
    () => (enabled ? equippedCharacterAccessories(inventory, catalog.items) : []),
    [catalog.items, enabled, inventory],
  )
}

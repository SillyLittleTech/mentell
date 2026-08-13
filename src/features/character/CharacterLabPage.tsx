import { useEffect, useMemo, useRef, useState } from 'react'
import { DeskCharacterShell } from './DeskCharacterShell'
import { charManifest } from './charManifest'
import { POSE_LABELS } from './characterPoses'
import type { CharacterPoseId } from './charManifest'
import {
  LAB_COLOR_ORDER,
  LAB_POSE_ORDER,
  LAB_TOGGLE_CONFIG,
} from './charLabControls'
import { OptionDial } from './lab/OptionDial'
import { LabSwitch } from './lab/LabSwitch'
import { useCharacterAppearance } from './useCharacterAppearance'
import {
  equipCharacterAccessoryItem,
  loadShopInventory,
  setCharacterAccessoryChoice,
  subscribeShopInventory,
  type ShopInventory,
} from '../shop/shopInventory'
import {
  loadShopCatalog,
  type CharacterAccessoryItem,
  type ShopCatalogItem,
} from '../shop/shopCatalog'
import { accessoryChoiceId, exclusiveAccessoryIdsFor } from '../shop/shopCharacterAccessories'
import { flushPendingCharacterAppearanceSave } from './characterAppearanceService'
import { pushLocalChangesNow } from '../../shared/sync/syncService'

function isCharacterAccessory(item: ShopCatalogItem): item is CharacterAccessoryItem {
  return item.type === 'characterAccessory'
}

export function CharacterLabPage() {
  const { appearance, setAppearance, resetAppearance } = useCharacterAppearance()
  const [pose, setPose] = useState<CharacterPoseId>('idle')
  const catalog = useMemo(() => loadShopCatalog(), [])
  const [inventory, setInventory] = useState<ShopInventory>(() => loadShopInventory())
  const dirtyRef = useRef(false)

  useEffect(() => subscribeShopInventory((next) => setInventory(next)), [])

  useEffect(() => {
    return () => {
      if (!dirtyRef.current) return
      void flushPendingCharacterAppearanceSave().then(() => pushLocalChangesNow())
    }
  }, [])

  const ownedAccessories = useMemo(() => {
    const owned = new Set(inventory.ownedItemIds)
    return catalog.items.filter(isCharacterAccessory).filter((item) => owned.has(item.id))
  }, [catalog.items, inventory.ownedItemIds])

  const equippedAccessoryIds = useMemo(
    () => new Set(inventory.equipped.characterAccessoryIds),
    [inventory.equipped.characterAccessoryIds],
  )

  const toggleByKey = useMemo(() => {
    const map = new Map<string, (typeof charManifest.toggleGroups)[number]>(
      charManifest.toggleGroups.map((g) => [g.key, g]),
    )
    return map
  }, [])
  function setFill(key: string, value: string) {
    if (colorValue(key, defaultForColorKey(key)) === value) return
    dirtyRef.current = true
    setAppearance((prev) => ({
      ...prev,
      fills: { ...prev.fills, [key]: value },
    }))
  }

  function setToggle(groupKey: string, optionId: string) {
    const current = appearance.toggles[groupKey] ?? toggleByKey.get(groupKey)?.defaultOption
    if (current === optionId) return
    dirtyRef.current = true
    setAppearance((prev) => ({
      ...prev,
      toggles: { ...prev.toggles, [groupKey]: optionId },
    }))
  }

  function colorValue(key: string, fallback: string) {
    return appearance.fills[key] ?? fallback
  }

  function defaultForColorKey(key: string) {
    const fillable = charManifest.fillables.find((f) => f.key === key)
    if (fillable) return fillable.defaultFill
    const global = charManifest.globalFillGroups.find((g) => g.key === key)
    return global?.defaultFill ?? '#000000'
  }

  function toggleAccessory(item: CharacterAccessoryItem) {
    dirtyRef.current = true
    equipCharacterAccessoryItem(item.id, {
      exclusiveWith: exclusiveAccessoryIdsFor(item, catalog.items),
    })
  }

  function chooseAccessoryChoice(item: CharacterAccessoryItem, choiceId: string) {
    if (accessoryChoiceId(item, inventory) === choiceId) return
    dirtyRef.current = true
    setCharacterAccessoryChoice(item.id, choiceId)
  }

  return (
    <section className="paper rounded-3xl p-6">
      <div className="font-paper text-2xl">Character lab</div>
      <div className="ink-muted mt-1 text-sm">
        Preview looks and poses. Changes save locally, sync to cloud backup (when enabled), and
        update both the desk mascot and browser tab icon.
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(12rem,16rem)_1fr]">
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="flex min-h-[280px] items-center justify-center overflow-visible rounded-2xl border border-[var(--paper-border)] bg-[var(--paper-bg)] p-4">
            <DeskCharacterShell
              pose={pose}
              appearance={appearance}
              closeEyesOnInteract
              pettable
              className="h-72 w-56"
              title="Character preview"
            />
          </div>
        </div>

        <div className="space-y-8">
          <fieldset className="space-y-4">
            <legend className="font-paper text-lg">Look</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {LAB_COLOR_ORDER.map(({ key, label }) => (
                <label
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--paper-border)] px-3 py-2 text-sm"
                >
                  <span>{label}</span>
                  <input
                    type="color"
                    value={colorValue(key, defaultForColorKey(key))}
                    onChange={(e) => setFill(key, e.target.value)}
                    className="h-9 w-14 cursor-pointer rounded border border-[var(--paper-border)] bg-transparent"
                  />
                </label>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {LAB_TOGGLE_CONFIG.filter((c) => c.kind === 'dial').map((cfg) => {
                const group = toggleByKey.get(cfg.groupKey)
                if (!group) return null
                const activeId = appearance.toggles[cfg.groupKey] ?? group.defaultOption
                const valueIndex = Math.max(
                  0,
                  group.options.findIndex((o) => o.id === activeId),
                )
                return (
                  <OptionDial
                    key={cfg.groupKey}
                    label={cfg.label}
                    options={[...group.options]}
                    valueIndex={valueIndex}
                    segmentLabels={cfg.dialLabels}
                    onChange={(id) => setToggle(cfg.groupKey, id)}
                  />
                )
              })}
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="font-paper text-lg">Shoppe accessories</legend>
            {ownedAccessories.length === 0 ? (
              <div className="ink-muted rounded-xl border border-[var(--paper-border)] px-3 py-2 text-sm">
                Unlock character accessories in the Shoppe to equip and customize them here.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {ownedAccessories.map((item) => {
                  const equipped = equippedAccessoryIds.has(item.id)
                  const colorKeys = item.characterAccessory.fillKeys ?? []
                  const choices = item.characterAccessory.choices ?? []
                  const selectedChoiceId = accessoryChoiceId(item, inventory)
                  return (
                    <div
                      key={item.id}
                      className="space-y-3 rounded-xl border border-[var(--paper-border)] p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium">{item.name}</div>
                          <div className="ink-muted text-xs">
                            {equipped ? 'Equipped' : 'Owned'}
                          </div>
                        </div>
                        <button
                          type="button"
                          className={`focus-ring rounded-xl border px-3 py-1.5 text-xs font-semibold ${
                            equipped
                              ? 'border-[var(--paper-ink)] bg-[var(--paper-ink)] text-[var(--paper-bg)]'
                              : 'border-[var(--paper-border)]'
                          }`}
                          onClick={() => toggleAccessory(item)}
                        >
                          {equipped ? 'Unequip' : 'Equip'}
                        </button>
                      </div>

                      {choices.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {choices.map((choice) => (
                            <button
                              key={choice.id}
                              type="button"
                              className={`focus-ring rounded-lg border px-2 py-1 text-xs ${
                                selectedChoiceId === choice.id
                                  ? 'border-[var(--paper-ink)] bg-[var(--paper-ink)] text-[var(--paper-bg)]'
                                  : 'border-[var(--paper-border)]'
                              }`}
                              onClick={() => chooseAccessoryChoice(item, choice.id)}
                            >
                              {choice.label}
                            </button>
                          ))}
                        </div>
                      ) : null}

                      {colorKeys.length > 0 ? (
                        <div className="grid gap-2">
                          {colorKeys.map((key) => (
                            <label
                              key={`${item.id}-${key}`}
                              className="flex items-center justify-between gap-3 text-sm"
                            >
                              <span className="ink-muted">{key.replace(/_/g, ' ')}</span>
                              <input
                                type="color"
                                value={colorValue(key, defaultForColorKey(key))}
                                onChange={(e) => setFill(key, e.target.value)}
                                className="h-9 w-14 cursor-pointer rounded border border-[var(--paper-border)] bg-transparent"
                              />
                            </label>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="font-paper text-lg">Face</legend>
            {LAB_TOGGLE_CONFIG.filter((c) => c.kind === 'switch').map((cfg) => {
              const group = toggleByKey.get(cfg.groupKey)
              if (!group || !('elementId' in group)) return null
              const on = (appearance.toggles[cfg.groupKey] ?? group.defaultOption) === 'on'
              return (
                <LabSwitch
                  key={cfg.groupKey}
                  label={cfg.label}
                  checked={on}
                  onChange={(checked) => setToggle(cfg.groupKey, checked ? 'on' : 'off')}
                />
              )
            })}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="font-paper text-lg">Pose</legend>
            <div className="flex flex-wrap gap-2">
              {LAB_POSE_ORDER.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`focus-ring rounded-xl border px-3 py-1.5 text-sm ${
                    pose === id
                      ? 'border-[var(--paper-ink)] bg-[var(--paper-ink)] text-[var(--paper-bg)]'
                      : 'border-[var(--paper-border)]'
                  }`}
                  onClick={() => setPose(id)}
                >
                  {POSE_LABELS[id]}
                </button>
              ))}
            </div>
            <p className="ink-muted text-xs">Pose preview applies to the full character only.</p>
          </fieldset>

          <button
            type="button"
            className="focus-ring rounded-xl border border-[var(--paper-border)] px-4 py-2 text-sm font-medium"
            onClick={() => {
              dirtyRef.current = true
              void resetAppearance()
            }}
          >
            Reset to defaults
          </button>
        </div>
      </div>
    </section>
  )
}

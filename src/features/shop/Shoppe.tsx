import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
  buyStreakFreeze,
  buyStreakRestore,
  getScoreSnapshot,
  spendScore,
  STREAK_FREEZE_COST,
  STREAK_FREEZE_MAX,
  STREAK_RESTORE_COST,
  type StreakRestoreCandidate,
} from '../score/scoreService'
import {
  addCollectedCat,
  loadCatCollection,
  type CollectedCat,
} from './catCollection'
import { WeekTimelineCard } from './WeekTimelineCard'
import { MentellCharacter } from '../character/MentellCharacter'
import { defaultCharacterAppearance } from '../character/characterAppearance'
import { useAppSettings } from '../../shared/settings/useAppSettings'
import { publicUrl } from '../../shared/publicUrl'
import { SCORE_CHANGED_EVENT } from '../score/scoreEvents'
import {
  equipShopItem,
  loadShopInventory,
  subscribeShopInventory,
  unlockShopItem,
  type ShopInventory,
} from './shopInventory'
import {
  loadShopCatalog,
  type CharacterAccessoryItem,
  type CursorItem,
  type ShopCatalogItem,
  type ThemeItem,
} from './shopCatalog'
import { renderCursorCssValue } from './shopCursorAsset'
import { renderStampPreviewForItem } from './shopStampAsset'

const CAT_COST = 250

type CatApiRow = { id?: string; url?: string }
type EquippableType = 'theme' | 'stamp' | 'cursor'

function ThemePreview({ item }: { item: ThemeItem }) {
  return (
    <div className="mt-3 rounded-xl border border-[var(--paper-border)] p-2">
      <div
        className="h-20 w-full rounded-lg"
        style={{
          background: `linear-gradient(135deg, ${item.theme.light.deskBg} 0%, ${item.theme.light.paperBg ?? item.theme.light.deskBg} 48%, ${item.theme.dark.deskBg} 52%, ${item.theme.dark.paperBg ?? item.theme.dark.deskBg} 100%)`,
        }}
      />
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] font-medium uppercase tracking-wide opacity-75">
        <span>Light desk</span>
        <span
          className="inline-block h-3 w-3 rounded-full border border-black/25"
          style={{ background: item.theme.light.deskBg }}
        />
        <span>Dark desk</span>
        <span
          className="inline-block h-3 w-3 rounded-full border border-white/30"
          style={{ background: item.theme.dark.deskBg }}
        />
      </div>
    </div>
  )
}

function CursorHoverPreview({ item }: { item: CursorItem }) {
  const defaultCursor = renderCursorCssValue(item, 'default')
  const pointerCursor = renderCursorCssValue(item, 'pointer') ?? defaultCursor
  const textCursor = renderCursorCssValue(item, 'text') ?? pointerCursor
  return (
    <div className="mt-3 rounded-xl border border-[var(--paper-border)] p-2">
      <div
        className="flex h-20 w-full items-center justify-between rounded-lg border border-[var(--paper-border)] bg-black/5 px-3 text-xs"
        style={{ cursor: defaultCursor ?? 'auto' }}
      >
        <span className="font-mono uppercase tracking-wide opacity-75">hover box</span>
        <button
          type="button"
          className="rounded-lg border border-[var(--paper-border)] px-2 py-1 text-[11px] font-semibold"
          style={{ cursor: pointerCursor ?? 'pointer' }}
        >
          pointer
        </button>
        <input
          type="text"
          readOnly
          value="text"
          aria-label={`${item.name} text cursor preview`}
          className="w-14 rounded border border-[var(--paper-border)] bg-transparent px-1.5 py-1 text-[11px]"
          style={{ cursor: textCursor ?? 'text' }}
        />
      </div>
    </div>
  )
}

function previewAccessoryItem(item: CharacterAccessoryItem): CharacterAccessoryItem {
  const choice =
    item.characterAccessory.choices?.find(
      (entry) => entry.id === item.characterAccessory.defaultChoiceId,
    ) ?? item.characterAccessory.choices?.[0]
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

function CharacterAccessoryPreview({ item }: { item: CharacterAccessoryItem }) {
  const previewItem = previewAccessoryItem(item)
  return (
    <div
      className="mt-3 flex h-28 w-full items-center justify-center overflow-hidden rounded-xl border border-[var(--paper-border)] bg-[var(--paper-bg)] p-2"
      role="img"
      aria-label={`${item.name} preview`}
    >
      <MentellCharacter
        pose="idle"
        appearance={defaultCharacterAppearance()}
        characterAccessories={[previewItem]}
        className="h-full w-full"
      />
    </div>
  )
}

function ShopItemPreview({ item, preview }: { item: ShopCatalogItem; preview: string | null }) {
  if (item.type === 'theme') return <ThemePreview item={item} />
  if (item.type === 'cursor') return <CursorHoverPreview item={item} />
  if (item.type === 'characterAccessory') return <CharacterAccessoryPreview item={item} />
  if (!preview) return null
  return (
    <img
      src={preview}
      alt=""
      className="mt-3 h-20 w-full rounded-xl border border-[var(--paper-border)] object-contain p-1"
      draggable={false}
    />
  )
}

export function Shoppe({
  onScoreChange,
}: {
  onScoreChange: (delta: number, hint: string | null) => void
}) {
  const { settings } = useAppSettings()
  const pointsOn = !settings.disablePoints
  const [busy, setBusy] = useState(false)
  const [busyItemId, setBusyItemId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [catUrl, setCatUrl] = useState<string | null>(null)
  const [catId, setCatId] = useState<string | null>(null)
  const catalog = useMemo(() => loadShopCatalog(), [])
  const [inventory, setInventory] = useState<ShopInventory>(() => loadShopInventory())
  const [collection, setCollection] = useState<CollectedCat[]>(() => loadCatCollection())
  const [selectedCat, setSelectedCat] = useState<CollectedCat | null>(null)
  const [balance, setBalance] = useState(() => getScoreSnapshot().total)
  const [freezeCount, setFreezeCount] = useState(() => getScoreSnapshot().streakFreezes)
  const [restoreCandidate, setRestoreCandidate] = useState<StreakRestoreCandidate | null>(
    () => getScoreSnapshot().streakRestore,
  )

  useEffect(() => {
    return subscribeShopInventory((next) => setInventory(next))
  }, [])

  useEffect(() => {
    const refreshScore = () => {
      const next = getScoreSnapshot()
      setBalance(next.total)
      setFreezeCount(next.streakFreezes)
      setRestoreCandidate(next.streakRestore)
    }
    window.addEventListener(SCORE_CHANGED_EVENT, refreshScore)
    return () => window.removeEventListener(SCORE_CHANGED_EVENT, refreshScore)
  }, [])

  function itemPreview(item: ShopCatalogItem) {
    if (item.type === 'stamp') return renderStampPreviewForItem(item)
    if (item.type === 'theme' || item.type === 'cursor') return null
    if (!item.preview) return null
    if (item.preview.startsWith('/')) return publicUrl(item.preview)
    return item.preview
  }

  function itemOwned(itemId: string) {
    return inventory.ownedItemIds.includes(itemId)
  }

  function equippedId(type: EquippableType) {
    if (type === 'theme') return inventory.equipped.themeId
    if (type === 'stamp') return inventory.equipped.stampId
    return inventory.equipped.cursorId
  }

  function itemTypeLabel(item: ShopCatalogItem) {
    if (item.type === 'theme') return 'Theme'
    if (item.type === 'stamp') return 'Stamp'
    if (item.type === 'cursor') return 'Cursor set'
    if (item.type === 'characterAccessory') {
      if (item.characterAccessory.scope === 'fullBody') return 'Full-body accessory'
      if (item.characterAccessory.scope === 'hair') return 'Hair accessory'
      if (item.characterAccessory.scope === 'wrist') return 'Wrist accessory'
      if (item.characterAccessory.scope === 'shirt') return 'Shirt accessory'
      if (item.characterAccessory.scope === 'shoes') return 'Shoe accessory'
      if (item.characterAccessory.scope === 'pants') return 'Pants accessory'
      if (item.characterAccessory.scope === 'face') return 'Face accessory'
      if (item.characterAccessory.scope === 'hat') return 'Hat accessory'
      return 'Pet accessory'
    }
    return 'Image'
  }

  function catalogHint(item: ShopCatalogItem) {
    if (item.type === 'theme') return 'Applies different desk/paper styling in light + dark mode.'
    if (item.type === 'stamp') return 'Updates the default submit stamp artwork in the send animation.'
    if (item.type === 'cursor') return 'Applies custom default, pointer, and text cursors.'
    if (item.type === 'characterAccessory') {
      return 'Unlocks an accessory for the Character lab.'
    }
    return 'Collectible image item for future gallery drops.'
  }

  function canEquip(item: ShopCatalogItem): item is Extract<ShopCatalogItem, { type: EquippableType }> {
    return item.type === 'theme' || item.type === 'stamp' || item.type === 'cursor'
  }

  async function buyCatPhoto() {
    if (busy || !pointsOn) return
    setBusy(true)
    setStatus(null)
    setError(null)
    try {
      const current = getScoreSnapshot().total
      if (current < CAT_COST) {
        setError(`You need ${CAT_COST - current} more points for this item.`)
        return
      }

      const response = await fetch(
        'https://api.thecatapi.com/v1/images/search?limit=1&size=med&mime_types=jpg,png',
      )
      if (!response.ok) {
        setError('Cat API is unavailable right now. Try again shortly.')
        return
      }

      const rows = (await response.json()) as CatApiRow[]
      const first = rows[0]
      if (!first?.url) {
        setError('No cat photo returned this time. Please retry.')
        return
      }

      const spend = spendScore(CAT_COST)
      if (!spend.ok) {
        setError(
          spend.reason === 'insufficient'
            ? 'Not enough points to complete this purchase.'
            : 'Cannot complete purchase due to invalid score state.',
        )
        return
      }

      setCatUrl(first.url)
      setCatId(first.id ?? null)
      setCollection(addCollectedCat({ id: first.id, url: first.url }))
      setBalance(getScoreSnapshot().total)
      onScoreChange(-CAT_COST, 'Cat photo collected')
      setStatus('Mystery cat collected.')
    } catch {
      setError('Failed to reach cat photo service.')
    } finally {
      setBusy(false)
    }
  }

  function buyFreeze() {
    if (busy || !pointsOn) return
    setError(null)
    setStatus(null)
    const result = buyStreakFreeze()
    setBalance(result.nextTotal)
    setFreezeCount(result.nextFreezes)
    if (!result.ok) {
      if (result.reason === 'max') {
        setError(`You can hold up to ${STREAK_FREEZE_MAX} streak freezes.`)
      } else if (result.reason === 'insufficient') {
        setError(`You need ${STREAK_FREEZE_COST - result.nextTotal} more points for a streak freeze.`)
      } else {
        setError('Cannot buy a streak freeze while points are disabled.')
      }
      return
    }
    onScoreChange(-STREAK_FREEZE_COST, 'Streak freeze stocked')
    setStatus(`Streak freeze stocked (${result.nextFreezes}/${STREAK_FREEZE_MAX}).`)
  }

  function buyRestore() {
    if (busy || !pointsOn) return
    setError(null)
    setStatus(null)
    const result = buyStreakRestore()
    setBalance(result.nextTotal)
    setRestoreCandidate(getScoreSnapshot().streakRestore)
    if (!result.ok) {
      if (result.reason === 'none') {
        setError('No recent broken streak is available to restore.')
      } else if (result.reason === 'insufficient') {
        setError(`You need ${STREAK_RESTORE_COST - result.nextTotal} more points to restore it.`)
      } else {
        setError('Cannot restore a streak while points are disabled.')
      }
      return
    }
    onScoreChange(-STREAK_RESTORE_COST, `Streak restored to ${result.restoredStreak}`)
    setStatus(`Streak restored to ${result.restoredStreak}.`)
  }

  async function buyShopItem(item: ShopCatalogItem) {
    if (busy || busyItemId || !pointsOn) return
    setError(null)
    setStatus(null)
    setBusyItemId(item.id)
    try {
      if (itemOwned(item.id)) {
        setStatus(`${item.name} is already unlocked.`)
        return
      }
      const current = getScoreSnapshot().total
      if (current < item.cost) {
        setError(`You need ${item.cost - current} more points for ${item.name}.`)
        return
      }
      const spend = spendScore(item.cost)
      if (!spend.ok) {
        setError(
          spend.reason === 'insufficient'
            ? 'Not enough points to complete this purchase.'
            : 'Cannot complete purchase due to invalid score state.',
        )
        return
      }
      unlockShopItem(item.id)
      if (canEquip(item)) {
        equipShopItem(item.type, item.id)
      }
      setBalance(getScoreSnapshot().total)
      onScoreChange(-item.cost, `${item.name} unlocked`)
      setStatus(
        item.type === 'characterAccessory'
          ? `${item.name} unlocked. Customize it in Character lab.`
          : canEquip(item)
            ? `${item.name} unlocked and equipped.`
            : `${item.name} unlocked.`,
      )
    } finally {
      setBusyItemId(null)
    }
  }

  function toggleEquip(item: Extract<ShopCatalogItem, { type: EquippableType }>) {
    if (!itemOwned(item.id)) return
    const current = equippedId(item.type)
    const next = current === item.id ? null : item.id
    equipShopItem(item.type, next)
    setStatus(next ? `${item.name} equipped.` : `${itemTypeLabel(item)} unequipped.`)
    setError(null)
  }

  return (
    <div className="space-y-4">
      <section className="paper rounded-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-paper text-2xl">Shoppe</div>
            <div className="ink-muted mt-1 text-sm">Spend points on little rewards.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="rounded-2xl border border-[var(--paper-border)] px-3 py-2">
              <div className="font-mono text-[11px] uppercase opacity-70">collected</div>
              <div className="font-mono text-2xl font-bold">{collection.length}</div>
            </div>
            <div className="rounded-2xl border border-[var(--paper-border)] px-3 py-2">
              <div className="font-mono text-[11px] uppercase opacity-70">shop unlocks</div>
              <div className="font-mono text-2xl font-bold">{inventory.ownedItemIds.length}</div>
            </div>
            {pointsOn ? (
              <div className="rounded-2xl border border-[var(--paper-border)] px-3 py-2">
                <div className="font-mono text-[11px] uppercase opacity-70">balance</div>
                <div className="font-mono text-2xl font-bold">{balance}</div>
              </div>
            ) : null}
            {pointsOn ? (
              <div className="rounded-2xl border border-[var(--paper-border)] px-3 py-2">
                <div className="font-mono text-[11px] uppercase opacity-70">freezes</div>
                <div className="font-mono text-2xl font-bold">{freezeCount}</div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <WeekTimelineCard />

      <section className="paper rounded-3xl p-6">
        <div className="font-paper text-xl">Customization shelves</div>
        <div className="ink-muted mt-1 text-sm">
          Unlock themes, stamp variants, and cursor sets from a JSON catalog.
        </div>
        {!pointsOn ? (
          <div className="ink-muted mt-4 rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-sm">
            Points are turned off in Settings — enable the points system to unlock shop items.
          </div>
        ) : null}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {catalog.items.map((item) => {
            const owned = itemOwned(item.id)
            const equippable = canEquip(item)
            const accessory = item.type === 'characterAccessory'
            const equipped = equippable && equippedId(item.type) === item.id
            const preview = itemPreview(item)
            return (
              <article
                key={item.id}
                className="rounded-2xl border border-[var(--paper-border)] p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="ink-muted text-xs">{itemTypeLabel(item)}</div>
                  </div>
                  <div className="font-mono text-sm font-bold">{item.cost} pts</div>
                </div>
                <div className="ink-muted mt-2 text-sm">{item.description}</div>
                <div className="ink-muted mt-1 text-xs">{catalogHint(item)}</div>
                <ShopItemPreview item={item} preview={preview} />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {!owned ? (
                    <button
                      type="button"
                      className="focus-ring rounded-xl border border-[var(--paper-border)] px-3 py-2 text-sm font-semibold"
                      disabled={!pointsOn || busyItemId === item.id || busy}
                      onClick={() => void buyShopItem(item)}
                    >
                      {busyItemId === item.id ? 'Unlocking…' : 'Unlock'}
                    </button>
                  ) : equippable ? (
                    <button
                      type="button"
                      className="focus-ring rounded-xl border border-[var(--paper-border)] px-3 py-2 text-sm font-semibold"
                      onClick={() => toggleEquip(item)}
                    >
                      {equipped ? 'Unequip' : 'Equip'}
                    </button>
                  ) : (
                    <span className="rounded-xl border border-[var(--paper-border)] px-3 py-2 text-xs font-semibold uppercase tracking-wide opacity-75">
                      Owned
                    </span>
                  )}
                  {owned ? (
                    <span className="rounded-full border border-[var(--paper-border)] px-2 py-1 text-[11px] font-semibold uppercase tracking-wide opacity-75">
                      {equipped ? 'Equipped' : accessory ? 'Owned' : 'Unlocked'}
                    </span>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="paper rounded-3xl p-6">
        <div className="rounded-3xl border border-[var(--paper-border)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-medium">Streak freeze</div>
              <div className="ink-muted text-sm">
                Saves a streak after exactly one missed day. Hold up to {STREAK_FREEZE_MAX}.
              </div>
            </div>
            <div className="font-mono text-lg font-bold">{STREAK_FREEZE_COST} pts</div>
          </div>

          {!pointsOn ? (
            <div className="ink-muted mt-4 rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-sm">
              Points are turned off in Settings — enable the points system to buy streak freezes.
            </div>
          ) : (
            <button
              type="button"
              className="focus-ring mt-4 rounded-2xl px-4 py-3 text-sm font-semibold"
              style={{ background: 'var(--warn)', color: 'rgba(0,0,0,0.85)' }}
              disabled={freezeCount >= STREAK_FREEZE_MAX}
              onClick={buyFreeze}
            >
              {freezeCount >= STREAK_FREEZE_MAX ? 'Freezer full' : 'Buy streak freeze'}
            </button>
          )}
        </div>
      </section>

      {restoreCandidate ? (
        <section className="paper rounded-3xl p-6">
          <div className="rounded-3xl border border-[var(--paper-border)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-medium">Restore streak</div>
                <div className="ink-muted text-sm">
                  Restore your recent streak to {restoreCandidate.restoreTo} after{' '}
                  {restoreCandidate.missedDays} missed day
                  {restoreCandidate.missedDays === 1 ? '' : 's'}.
                </div>
              </div>
              <div className="font-mono text-lg font-bold">{STREAK_RESTORE_COST} pts</div>
            </div>
            <button
              type="button"
              className="focus-ring mt-4 rounded-2xl px-4 py-3 text-sm font-semibold"
              style={{ background: 'var(--success)', color: 'rgba(0,0,0,0.9)' }}
              disabled={!pointsOn}
              onClick={buyRestore}
            >
              Restore streak
            </button>
          </div>
        </section>
      ) : null}

      <section className="paper rounded-3xl p-6">
        <div className="rounded-3xl border border-[var(--paper-border)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-medium">Mystery cat photo</div>
              <div className="ink-muted text-sm">A random cat print from the Cat API.</div>
            </div>
            <div className="font-mono text-lg font-bold">{CAT_COST} pts</div>
          </div>

          {!pointsOn ? (
            <div className="ink-muted mt-4 rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-sm">
              Points are turned off in Settings — enable the points system to collect cats.
            </div>
          ) : (
            <button
              type="button"
              className="focus-ring mt-4 rounded-2xl px-4 py-3 text-sm font-semibold"
              style={{ background: 'var(--success)', color: 'rgba(0,0,0,0.9)' }}
              disabled={busy}
              onClick={buyCatPhoto}
            >
              {busy ? 'Collecting…' : 'Collect a mystery cat'}
            </button>
          )}

          {error ? (
            <div className="mt-3 rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          ) : null}
          {status ? (
            <div className="mt-3 rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-sm text-[var(--success)]">
              {status}
            </div>
          ) : null}
        </div>
      </section>

      {catUrl ? (
        <section className="paper rounded-3xl p-6">
          <div className="font-paper text-xl">Latest collection</div>
          <div className="ink-muted mt-1 text-sm">Your newest mystery cat.</div>
          <img
            src={catUrl}
            alt="Collected mystery cat"
            className="mt-4 w-full rounded-3xl border border-[var(--paper-border)] object-cover"
          />
          {catId ? <div className="ink-muted mt-2 text-xs">Cat ID: {catId}</div> : null}
        </section>
      ) : null}

      <section className="paper rounded-3xl p-6">
        <div className="font-paper text-xl">My collection</div>
        <div className="ink-muted mt-1 text-sm">
          {collection.length === 0
            ? 'No cats collected yet — adopt your first mystery cat above.'
            : `${collection.length} cat${collection.length === 1 ? '' : 's'} in your gallery.`}
        </div>

        {collection.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {collection.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className="focus-ring overflow-hidden rounded-2xl border border-[var(--paper-border)]"
                onClick={() => setSelectedCat(cat)}
              >
                <img
                  src={cat.url}
                  alt="Collected cat"
                  className="aspect-square w-full object-cover"
                />
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {selectedCat ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-6"
          onClick={() => setSelectedCat(null)}
        >
          <div
            className="paper w-full max-w-lg rounded-3xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="font-paper text-xl">Collected cat</div>
              <button
                type="button"
                className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-sm"
                onClick={() => setSelectedCat(null)}
              >
                Close
              </button>
            </div>
            <img
              src={selectedCat.url}
              alt="Collected cat detail"
              className="mt-4 w-full rounded-3xl border border-[var(--paper-border)] object-cover"
            />
            <div className="ink-muted mt-3 text-sm">
              Collected {format(selectedCat.collectedAt, 'MMM d, yyyy')}
            </div>
            <div className="ink-muted mt-1 text-xs">ID: {selectedCat.id}</div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

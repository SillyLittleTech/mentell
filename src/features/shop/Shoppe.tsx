import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { getScoreSnapshot, spendScore } from '../score/scoreService'
import {
  addCollectedCat,
  loadCatCollection,
  type CollectedCat,
} from './catCollection'
import { WeekTimelineCard } from './WeekTimelineCard'
import { useAppSettings } from '../../shared/settings/useAppSettings'

const CAT_COST = 250

type CatApiRow = { id?: string; url?: string }

export function Shoppe({ onSpent }: { onSpent: () => void }) {
  const { settings } = useAppSettings()
  const pointsOn = !settings.disablePoints
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [catUrl, setCatUrl] = useState<string | null>(null)
  const [catId, setCatId] = useState<string | null>(null)
  const [collection, setCollection] = useState<CollectedCat[]>(() => loadCatCollection())
  const [selectedCat, setSelectedCat] = useState<CollectedCat | null>(null)
  const [balance, setBalance] = useState(() => getScoreSnapshot().total)

  useEffect(() => {
    setBalance(getScoreSnapshot().total)
  }, [collection])

  async function buyCatPhoto() {
    if (busy || !pointsOn) return
    setBusy(true)
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
      onSpent()
    } catch {
      setError('Failed to reach cat photo service.')
    } finally {
      setBusy(false)
    }
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
            {pointsOn ? (
              <div className="rounded-2xl border border-[var(--paper-border)] px-3 py-2">
                <div className="font-mono text-[11px] uppercase opacity-70">balance</div>
                <div className="font-mono text-2xl font-bold">{balance}</div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <WeekTimelineCard />

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

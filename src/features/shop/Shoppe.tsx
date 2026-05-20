import { useState } from 'react'
import { getScoreSnapshot, spendScore } from '../score/scoreService'

const CAT_COST = 250

type CatApiRow = { id?: string; url?: string }

export function Shoppe({ onSpent }: { onSpent: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [catUrl, setCatUrl] = useState<string | null>(null)
  const [catId, setCatId] = useState<string | null>(null)
  const balance = getScoreSnapshot().total

  async function buyCatPhoto() {
    if (busy) return
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
          <div className="rounded-2xl border border-[var(--paper-border)] px-3 py-2">
            <div className="font-mono text-[11px] uppercase opacity-70">balance</div>
            <div className="font-mono text-2xl font-bold">{balance}</div>
          </div>
        </div>
      </section>

      <section className="paper rounded-3xl p-6">
        <div className="rounded-3xl border border-[var(--paper-border)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-medium">Mystery cat photo</div>
              <div className="ink-muted text-sm">A random cat print from the Cat API.</div>
            </div>
            <div className="font-mono text-lg font-bold">{CAT_COST} pts</div>
          </div>

          <button
            type="button"
            className="focus-ring mt-4 rounded-2xl px-4 py-3 text-sm font-semibold"
            style={{ background: 'var(--success)', color: 'rgba(0,0,0,0.9)' }}
            disabled={busy}
            onClick={buyCatPhoto}
          >
            {busy ? 'Buying…' : 'Buy random cat photo'}
          </button>

          {error ? (
            <div className="mt-3 rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          ) : null}
        </div>
      </section>

      {catUrl ? (
        <section className="paper rounded-3xl p-6">
          <div className="font-paper text-xl">Latest purchase</div>
          <div className="ink-muted mt-1 text-sm">Random cat photo received.</div>
          <img
            src={catUrl}
            alt="Purchased random cat"
            className="mt-4 w-full rounded-3xl border border-[var(--paper-border)] object-cover"
          />
          {catId ? <div className="ink-muted mt-2 text-xs">Cat ID: {catId}</div> : null}
        </section>
      ) : null}
    </div>
  )
}

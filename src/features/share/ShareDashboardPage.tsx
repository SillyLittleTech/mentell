import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { fetchPublicShare, type PublicShareDoc } from './shareCodeService'
import { isShareLinksEnabled } from '../../shared/features/featureFlags'

export function ShareDashboardPage() {
  const { code = '' } = useParams()
  const [doc, setDoc] = useState<PublicShareDoc | null | undefined>(undefined)
  const enabled = isShareLinksEnabled()

  useEffect(() => {
    if (!enabled || !code) {
      setDoc(null)
      return
    }
    let active = true
    void fetchPublicShare(code).then((d) => {
      if (active) setDoc(d)
    })
    return () => {
      active = false
    }
  }, [code, enabled])

  if (!enabled) {
    return (
      <div className="desk flex min-h-[100svh] items-center justify-center p-6">
        <div className="paper max-w-md rounded-3xl p-6 text-center">
          <div className="font-paper text-xl">Sharing is disabled</div>
          <div className="ink-muted mt-2 text-sm">This build does not include share links.</div>
        </div>
      </div>
    )
  }

  if (doc === undefined) {
    return (
      <div className="desk flex min-h-[100svh] items-center justify-center p-6">
        <div className="ink-muted font-mono text-sm">Loading shared view…</div>
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="desk flex min-h-[100svh] items-center justify-center p-6">
        <div className="paper max-w-md rounded-3xl p-6 text-center">
          <div className="font-paper text-xl">Link unavailable</div>
          <div className="ink-muted mt-2 text-sm">
            This share link is invalid or has expired.
          </div>
        </div>
      </div>
    )
  }

  const p = doc.payload
  const expires = format(doc.expiresAt.toDate(), 'PPp')

  return (
    <div className="desk min-h-[100svh] px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-4">
        <header className="paper rounded-3xl p-6 text-center">
          <div className="font-paper text-2xl">Mentell shared view</div>
          {doc.ownerDisplayName ? (
            <div className="ink-muted mt-1 text-sm">Shared by {doc.ownerDisplayName}</div>
          ) : null}
          {doc.label ? <div className="mt-2 font-medium">{doc.label}</div> : null}
          <div className="ink-muted mt-2 text-xs">Read-only · expires {expires}</div>
        </header>

        <section className="paper rounded-3xl p-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {doc.permissions.showEntryCounts ? (
              <Stat label="Entries" value={String(p.entryCount)} />
            ) : null}
            {doc.permissions.showSentimentBreakdown ? (
              <>
                <Stat label="+" value={String(p.positives)} />
                <Stat label="=" value={String(p.mixed)} />
                <Stat label="-" value={String(p.negatives)} />
              </>
            ) : null}
            {doc.permissions.showWarningsCount ? (
              <Stat label="Warnings" value={String(p.warnings)} />
            ) : null}
            {doc.permissions.showStreak && p.streak !== undefined ? (
              <Stat label="Streak" value={String(p.streak)} />
            ) : null}
            {doc.permissions.showScore && p.score !== undefined ? (
              <Stat label="Score" value={String(p.score)} />
            ) : null}
          </div>
        </section>

        {doc.permissions.showRecentEntries && p.entries.length > 0 ? (
          <section className="paper rounded-3xl p-6">
            <div className="font-paper text-lg">Recent entries</div>
            <ul className="mt-4 space-y-3">
              {p.entries.map((e) => (
                <li
                  key={e.id}
                  className="rounded-2xl border border-[var(--paper-border)] p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm">{e.dateKey}</span>
                    <span className="font-mono text-lg font-bold">{e.sentiment}</span>
                  </div>
                  {e.situation ? (
                    <div className="mt-2 font-medium">{e.situation}</div>
                  ) : null}
                  {e.emotion ? (
                    <div className="ink-muted mt-1 text-sm">Emotion: {e.emotion}</div>
                  ) : null}
                  {e.details ? (
                    <div className="ink-muted mt-2 whitespace-pre-wrap text-sm">{e.details}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <footer className="ink-muted text-center text-xs">
          Not for emergency use. Not a clinical record. Mentell does not certify HIPAA
          compliance on the free tier.
        </footer>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-center">
      <div className="font-mono text-[10px] uppercase opacity-70">{label}</div>
      <div className="font-mono text-xl font-bold">{value}</div>
    </div>
  )
}

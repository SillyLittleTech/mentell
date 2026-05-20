import { useEffect, useMemo, useState } from 'react'
import { db } from '../../db/schema'
import { makeId } from '../../shared/id'
import { getForcePackages, getSlowMo, isDebugMode, setForcePackages, setSlowMo } from '../../shared/debug/debugFlags'
import { ensurePackage } from '../packages/packageService'
import { requestNotificationsPermission } from '../../pwa/notifications'

export function DebugPanel() {
  const enabled = useMemo(() => isDebugMode(), [])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [slowMo, setSlowMoState] = useState(getSlowMo())
  const [forcePackages, setForcePackagesState] = useState(getForcePackages())
  const [inspector, setInspector] = useState<{
    entries: number
    notes: number
    stickies: number
    packages: number
    scoreTotal: string | null
    scoreStreak: string | null
    lastDay: string | null
    recentEntries: Array<{ dateKey: string; sentiment: string; warningLevel: string }>
    recentPackages: Array<{ kind: string; periodKey: string; opened: boolean }>
  } | null>(null)

  async function refreshInspector() {
    const [entries, notes, stickies, packages] = await Promise.all([
      db.entries.count(),
      db.notes.count(),
      db.stickies.count(),
      db.packages.count(),
    ])

    const recentEntriesRows = await db.entries.orderBy('createdAt').reverse().limit(6).toArray()
    const recentPackagesRows = await db.packages.orderBy('createdAt').reverse().limit(6).toArray()

    setInspector({
      entries,
      notes,
      stickies,
      packages,
      scoreTotal: localStorage.getItem('mentell.score.total'),
      scoreStreak: localStorage.getItem('mentell.score.streak'),
      lastDay: localStorage.getItem('mentell.score.lastDay'),
      recentEntries: recentEntriesRows.map((e) => ({
        dateKey: e.dateKey,
        sentiment: e.sentiment,
        warningLevel: e.warningLevel,
      })),
      recentPackages: recentPackagesRows.map((p) => ({
        kind: p.kind,
        periodKey: p.periodKey,
        opened: Boolean(p.openedAt),
      })),
    })
  }

  useEffect(() => {
    if (!enabled || !open) return
    const t = window.setTimeout(() => {
      refreshInspector()
    }, 0)
    return () => window.clearTimeout(t)
  }, [enabled, open])

  if (!enabled) return null

  return (
    <div className="fixed left-5 bottom-5 z-30">
      {open ? (
        <div className="paper w-[360px] rounded-3xl p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="font-mono text-sm font-bold">debug</div>
            <button
              type="button"
              className="focus-ring rounded-xl border border-[var(--paper-border)] px-2 py-1 text-xs"
              onClick={() => setOpen(false)}
            >
              close
            </button>
          </div>
          <div className="ink-muted mt-1 text-xs">Local-only helpers (not in production builds).</div>

          <div className="mt-4 grid gap-2">
            <div className="rounded-3xl border border-[var(--paper-border)] p-3">
              <div className="font-mono text-xs font-bold">ui toggles</div>
              <div className="mt-2 grid gap-2">
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>Slow‑mo animations</span>
                  <select
                    className="focus-ring rounded-2xl border border-[var(--paper-border)] bg-transparent px-3 py-2 text-xs"
                    value={slowMo}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      setSlowMo(v)
                      setSlowMoState(v)
                    }}
                  >
                    <option value={0.5}>0.5x</option>
                    <option value={1}>1x</option>
                    <option value={2}>2x</option>
                    <option value={4}>4x</option>
                  </select>
                </label>

                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>Force package alert</span>
                  <input
                    type="checkbox"
                    checked={forcePackages}
                    onChange={(e) => {
                      setForcePackages(e.target.checked)
                      setForcePackagesState(e.target.checked)
                    }}
                  />
                </label>

                <button
                  type="button"
                  disabled={busy}
                  className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                  onClick={async () => {
                    await requestNotificationsPermission()
                  }}
                >
                  Request notifications permission
                  <div className="ink-muted text-xs">For testing OS notification permission flow.</div>
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--paper-border)] p-3">
              <div className="font-mono text-xs font-bold">packages</div>
              <div className="mt-2 grid gap-2">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    className="focus-ring rounded-2xl border border-[var(--paper-border)] px-2 py-2 text-xs font-medium disabled:opacity-60"
                    onClick={async () => {
                      setBusy(true)
                      try {
                        await ensurePackage('weekly', `debug-W${Date.now()}`)
                        await refreshInspector()
                      } finally {
                        setBusy(false)
                      }
                    }}
                  >
                    add weekly
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="focus-ring rounded-2xl border border-[var(--paper-border)] px-2 py-2 text-xs font-medium disabled:opacity-60"
                    onClick={async () => {
                      setBusy(true)
                      try {
                        await ensurePackage('monthly', `debug-M${Date.now()}`)
                        await refreshInspector()
                      } finally {
                        setBusy(false)
                      }
                    }}
                  >
                    add monthly
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="focus-ring rounded-2xl border border-[var(--paper-border)] px-2 py-2 text-xs font-medium disabled:opacity-60"
                    onClick={async () => {
                      setBusy(true)
                      try {
                        await ensurePackage('yearly', `debug-Y${Date.now()}`)
                        await refreshInspector()
                      } finally {
                        setBusy(false)
                      }
                    }}
                  >
                    add yearly
                  </button>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                  onClick={async () => {
                    // simulate “delivery” by creating unopened packages at once
                    setBusy(true)
                    try {
                      await ensurePackage('weekly', `debug-batch-W${Date.now()}`)
                      await ensurePackage('monthly', `debug-batch-M${Date.now()}`)
                      await ensurePackage('yearly', `debug-batch-Y${Date.now()}`)
                      await refreshInspector()
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  Drop a batch (W/M/Y)
                  <div className="ink-muted text-xs">Triggers alert escalation + truck.</div>
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--paper-border)] p-3">
              <div className="font-mono text-xs font-bold">storage inspector</div>
              <div className="mt-2 grid gap-2">
                <button
                  type="button"
                  disabled={busy}
                  className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
                  onClick={async () => {
                    setBusy(true)
                    try {
                      await refreshInspector()
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  Refresh inspector
                </button>

                {inspector ? (
                  <div className="ink-muted rounded-2xl border border-[var(--paper-border)] p-3 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>entries: {inspector.entries}</div>
                      <div>packages: {inspector.packages}</div>
                      <div>notes: {inspector.notes}</div>
                      <div>stickies: {inspector.stickies}</div>
                    </div>
                    <div className="mt-2">
                      score: {inspector.scoreTotal ?? '0'} (streak {inspector.scoreStreak ?? '0'})
                    </div>
                    <div className="mt-2">
                      recent entries:
                      {inspector.recentEntries.length ? (
                        <ul className="mt-1 list-disc pl-4">
                          {inspector.recentEntries.map((e) => (
                            <li key={`${e.dateKey}-${e.sentiment}`}>
                              {e.dateKey} [{e.sentiment}] {e.warningLevel === 'warn' ? '(!)' : ''}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="mt-1">—</div>
                      )}
                    </div>
                    <div className="mt-2">
                      recent packages:
                      {inspector.recentPackages.length ? (
                        <ul className="mt-1 list-disc pl-4">
                          {inspector.recentPackages.map((p) => (
                            <li key={`${p.kind}-${p.periodKey}`}>
                              {p.kind} {p.periodKey} {p.opened ? '(opened)' : '(new)'}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="mt-1">—</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="ink-muted text-xs">No snapshot yet.</div>
                )}
              </div>
            </div>

            <button
              type="button"
              disabled={busy}
              className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
              onClick={async () => {
                setBusy(true)
                try {
                  await db.entries.clear()
                  await db.notes.clear()
                  await db.stickies.clear()
                  await db.packages.clear()
                  localStorage.removeItem('mentell.score.total')
                  localStorage.removeItem('mentell.score.streak')
                  localStorage.removeItem('mentell.score.lastDay')
                  window.location.reload()
                } finally {
                  setBusy(false)
                }
              }}
            >
              Reset local data
              <div className="ink-muted text-xs">Clears IndexedDB + score keys.</div>
            </button>

            <button
              type="button"
              disabled={busy}
              className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
              onClick={async () => {
                localStorage.removeItem('mentell.score.total')
                localStorage.removeItem('mentell.score.streak')
                localStorage.removeItem('mentell.score.lastDay')
                await refreshInspector()
              }}
            >
              Reset score only
              <div className="ink-muted text-xs">Keeps IndexedDB, clears score/streak.</div>
            </button>

            <button
              type="button"
              disabled={busy}
              className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
              onClick={async () => {
                setBusy(true)
                try {
                  const now = Date.now()
                  const mk = (dateKey: string, sentiment: '+' | '-' | '=') => ({
                    id: makeId('entry'),
                    createdAt: now,
                    dateKey,
                    sentiment,
                    situation: `Seeded situation (${sentiment})`,
                    details: `Seeded details for ${dateKey}.\nA little stationery vibe.`,
                    flaggedTerms: [],
                    warningLevel: 'none' as const,
                    scoreDelta: 100,
                    streakAtSubmit: 1,
                  })
                  await db.entries.bulkPut([
                    mk('2026-05-18', '+'),
                    mk('2026-05-19', '='),
                    mk('2026-05-20', '-'),
                  ])
                  await refreshInspector()
                } finally {
                  setBusy(false)
                }
              }}
            >
              Seed sample week
              <div className="ink-muted text-xs">Adds 3 entries for quick projector testing.</div>
            </button>
          </div>
        </div>
      ) : null}

      {!open ? (
        <button
          type="button"
          className="focus-ring paper rounded-3xl px-4 py-3 font-mono text-sm font-bold"
          onClick={() => setOpen(true)}
        >
          debug
        </button>
      ) : null}
    </div>
  )
}


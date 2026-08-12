import { format } from 'date-fns'
import { useEffect, useState } from 'react'
import { getScoreSnapshot } from '../../features/score/scoreService'
import { useAuthOptional } from '../../shared/firebase/AuthProvider'
import {
  fetchCloudScoreMeta,
  getRecoverableScoreOptions,
  restoreScoreFromCloud,
  type CloudScoreMeta,
} from '../../shared/sync/scoreRecovery'

export function ScoreRecoverySection() {
  const auth = useAuthOptional()
  const [meta, setMeta] = useState<CloudScoreMeta | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [localTotal, setLocalTotal] = useState(() => getScoreSnapshot().total)

  useEffect(() => {
    if (!auth?.user?.uid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMeta(null)
      return
    }
    void fetchCloudScoreMeta(auth.user.uid)
      .then(setMeta)
      .catch(() => setMeta(null))
  }, [auth?.user?.uid])

  useEffect(() => {
    const refresh = () => setLocalTotal(getScoreSnapshot().total)
    refresh()
    window.addEventListener('mentell:score-changed', refresh)
    return () => window.removeEventListener('mentell:score-changed', refresh)
  }, [])

  if (!auth?.user || !auth.syncEnabled) return null

  const options = getRecoverableScoreOptions(meta, localTotal)
  const canRestoreCloud = options.cloudTotal > localTotal
  const canRestorePeak = options.peakTotal > localTotal
  const hasBackups = options.snapshots.length > 0

  if (!canRestoreCloud && !canRestorePeak && !hasBackups) return null

  async function runRestore(
    label: string,
    source: 'cloud' | 'peak' | { snapshotIndex: number },
  ) {
    if (!auth?.user) return
    setBusy(true)
    setMessage(`${label}…`)
    try {
      const restored = await restoreScoreFromCloud(auth.user.uid, source)
      await auth.syncNow()
      setMessage(`Restored ${restored.total.toLocaleString()} points (streak ${restored.streak}).`)
      setMeta(await fetchCloudScoreMeta(auth.user.uid))
      setLocalTotal(restored.total)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-[var(--paper-border)] p-4">
      <div className="text-sm font-medium">Score recovery</div>
      <p className="ink-muted mt-1 text-xs">
        Local: {localTotal.toLocaleString()} pts · Cloud: {options.cloudTotal.toLocaleString()} pts
        {options.peakTotal > Math.max(localTotal, options.cloudTotal)
          ? ` · Peak saved: ${options.peakTotal.toLocaleString()} pts`
          : ''}
      </p>
      <p className="ink-muted mt-1 text-xs">
        If a test device overwrote your score, restore from a cloud backup below. Future syncs keep
        the higher account history and won&apos;t let fresh installs replace it.
      </p>
      <div className="mt-3 grid gap-2">
        {canRestoreCloud ? (
          <button
            type="button"
            disabled={busy}
            className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
            onClick={() => void runRestore('Restoring cloud score', 'cloud')}
          >
            Restore cloud score ({options.cloudTotal.toLocaleString()} pts)
          </button>
        ) : null}
        {canRestorePeak ? (
          <button
            type="button"
            disabled={busy}
            className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
            onClick={() => void runRestore('Restoring peak score', 'peak')}
          >
            Restore peak score ({options.peakTotal.toLocaleString()} pts)
          </button>
        ) : null}
        {options.snapshots.map((snapshot) => (
          <button
            key={`${snapshot.savedAt}-${snapshot.index}`}
            type="button"
            disabled={busy}
            className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left text-sm disabled:opacity-60"
            onClick={() =>
              void runRestore(
                `Restoring backup from ${format(snapshot.savedAt, 'PPp')}`,
                { snapshotIndex: snapshot.index },
              )
            }
          >
            Restore backup · {snapshot.total.toLocaleString()} pts
            <div className="ink-muted text-xs">{format(snapshot.savedAt, 'PPp')}</div>
          </button>
        ))}
      </div>
      {message ? <p className="mt-2 text-xs">{message}</p> : null}
    </div>
  )
}

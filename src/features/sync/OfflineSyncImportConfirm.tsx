import { useState } from 'react'
import { format } from 'date-fns'
import type { OfflineSyncPayload } from './cryptSync'

export function OfflineSyncImportConfirm({
  payload,
  entryCount,
  busy = false,
  error = null,
  doneLabel = null,
  onMerge,
  onReplace,
  onCancel,
}: {
  payload: OfflineSyncPayload
  entryCount: number
  busy?: boolean
  error?: string | null
  doneLabel?: string | null
  onMerge: () => void
  onReplace: () => void
  onCancel: () => void
}) {
  const [confirmReplace, setConfirmReplace] = useState(false)

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-2xl border border-[var(--paper-border)] p-4 text-sm">
        <div className="mb-2 font-bold">Import sync data?</div>
        <div className="mb-1">
          <span className="font-semibold">Source:</span> {payload.sender.displayName || 'Unknown'}{' '}
          {payload.sender.identifier ? `(${payload.sender.identifier})` : ''}
        </div>
        <div className="mb-1">
          <span className="font-semibold">Created:</span> {format(payload.createdAt, 'PPp')}
        </div>
        <div className="mb-2">
          <span className="font-semibold">Payload:</span> Found {entryCount} entries plus notes,
          stickies, packages, and settings
        </div>
        {confirmReplace ? (
          <div className="italic">
            Replace this device with the snapshot? Local entries, notes, stickies, and packages that
            are not in the snapshot will be deleted. Use this when this snapshot is the master copy.
          </div>
        ) : (
          <div className="italic">
            Merge keeps local-only items and updates overlapping ones. Replace makes this device
            match the snapshot.
          </div>
        )}
      </div>
      {error ? (
        <div className="text-sm" style={{ color: 'var(--danger)' }}>
          {error}
        </div>
      ) : null}
      {doneLabel ? (
        <p className="text-sm">{doneLabel}</p>
      ) : confirmReplace ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="focus-ring w-full rounded-2xl border px-4 py-2 text-sm font-semibold disabled:opacity-60"
            style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
            disabled={busy}
            onClick={onReplace}
          >
            {busy ? 'Replacing…' : 'Confirm replace'}
          </button>
          <button
            type="button"
            className="focus-ring w-full rounded-2xl border border-[var(--paper-border)] px-4 py-2 text-sm"
            disabled={busy}
            onClick={() => setConfirmReplace(false)}
          >
            Back
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="focus-ring w-full rounded-2xl border border-[var(--paper-border)] px-4 py-2 text-sm font-semibold disabled:opacity-60"
            disabled={busy}
            onClick={onMerge}
          >
            {busy ? 'Merging…' : 'Merge with this device'}
          </button>
          <button
            type="button"
            className="focus-ring w-full rounded-2xl border border-[var(--paper-border)] px-4 py-2 text-sm disabled:opacity-60"
            disabled={busy}
            onClick={() => setConfirmReplace(true)}
          >
            Replace this device
          </button>
          <button
            type="button"
            className="focus-ring w-full rounded-2xl border border-[var(--paper-border)] px-4 py-2 text-sm"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

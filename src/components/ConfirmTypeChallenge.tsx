import { useEffect, useState } from 'react'

type Props = {
  open: boolean
  title: string
  description: string
  challengeWord: string
  confirmLabel: string
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmTypeChallenge({
  open,
  title,
  description,
  challengeWord,
  confirmLabel,
  busy = false,
  onCancel,
  onConfirm,
}: Props) {
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (open) setTyped('')
  }, [open, challengeWord])

  if (!open) return null

  const match = typed === challengeWord

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-challenge-title"
    >
      <div className="paper max-w-md rounded-3xl p-6 shadow-lg">
        <div id="confirm-challenge-title" className="font-paper text-xl">
          {title}
        </div>
        <p className="ink-muted mt-2 text-sm">{description}</p>
        <p className="mt-4 text-sm">
          Type <span className="font-mono font-semibold">{challengeWord}</span> to confirm.
        </p>
        <input
          type="text"
          autoComplete="off"
          className="focus-ring mt-2 w-full rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3 font-mono"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={challengeWord}
        />
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="focus-ring rounded-2xl border border-[var(--paper-border)] px-4 py-2 text-sm"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="focus-ring rounded-2xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--danger)' }}
            disabled={!match || busy}
            onClick={onConfirm}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

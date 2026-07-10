export type ProgressState = 'write' | 'review' | 'warn'

function colorFor(state: ProgressState) {
  if (state === 'warn') return 'var(--danger)'
  if (state === 'review') return 'var(--primary-action)'
  return 'var(--success)'
}

function labelFor(state: ProgressState) {
  if (state === 'warn') return 'A little warning'
  if (state === 'review') return 'Let’s review'
  return 'Let’s start writing'
}

export function ProgressLight({ state }: { state: ProgressState }) {
  const color = colorFor(state)
  const label = labelFor(state)
  return (
    <div className="paper flex items-center justify-between gap-4 rounded-2xl px-4 py-3">
      <div className="flex items-center gap-3">
        <div
          aria-hidden="true"
          className="h-4 w-4 rounded-full"
          style={{ background: color, boxShadow: `0 0 0 3px rgba(0,0,0,0.12)` }}
        />
        <div className="font-medium">{label}</div>
      </div>
      {state === 'warn' ? (
        <div
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--paper-border)] font-mono text-lg"
          style={{ color: 'var(--danger)' }}
          aria-label="Warning"
          title="Warning"
        >
          !
        </div>
      ) : null}
    </div>
  )
}


export function OptionDial({
  label,
  options,
  valueIndex,
  onChange,
  segmentLabels,
}: {
  label: string
  options: { id: string; label: string }[]
  valueIndex: number
  onChange: (optionId: string) => void
  segmentLabels?: string[]
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-sm font-medium">{label}</div>
      <div
        className="inline-flex rounded-xl border border-[var(--paper-border)] p-0.5"
        role="group"
        aria-label={label}
      >
        {options.map((opt, i) => {
          const pressed = i === valueIndex
          const seg = segmentLabels?.[i] ?? String(i + 1)
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={pressed}
              className={`focus-ring min-w-[2.25rem] rounded-lg px-2.5 py-1.5 text-sm font-medium tabular-nums ${
                pressed
                  ? 'bg-[var(--paper-ink)] text-[var(--paper-bg)]'
                  : 'text-[var(--paper-ink)] opacity-70 hover:opacity-100'
              }`}
              onClick={() => onChange(opt.id)}
            >
              {seg}
            </button>
          )
        })}
      </div>
    </div>
  )
}

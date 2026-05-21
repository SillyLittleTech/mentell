import { publicUrl } from '../shared/publicUrl'

export type SentimentValue = '+' | '-' | '='

const ITEMS: Array<{ value: SentimentValue; label: string }> = [
  { value: '+', label: 'Positive' },
  { value: '=', label: 'Mixed' },
  { value: '-', label: 'Negative' },
]

export function SentimentPills({
  value,
  onChange,
}: {
  value: SentimentValue
  onChange: (value: SentimentValue) => void
}) {
  return (
    <div className="flex items-center gap-3">
      {ITEMS.map((it) => {
        const active = it.value === value
        const src =
          it.value === '+'
            ? publicUrl('/asset/pill_positive.png')
            : it.value === '-'
              ? publicUrl('/asset/pill_negative.png')
              : publicUrl('/asset/pill_mixed.png')
        return (
          <button
            key={it.value}
            type="button"
            className={[
              'focus-ring inline-flex select-none items-center justify-center rounded-pill px-6 py-3',
              'border border-[var(--paper-border)]',
              'transition-[transform,filter,box-shadow] duration-150',
              'bg-[rgba(251,244,222,0.9)]',
              active
                ? 'shadow-[inset_0_2px_6px_rgba(0,0,0,0.22),0_10px_20px_rgba(0,0,0,0.12)]'
                : 'hover:shadow-[0_10px_18px_rgba(0,0,0,0.10)] hover:-translate-y-[1px]',
            ].join(' ')}
            aria-pressed={active}
            onClick={() => onChange(it.value)}
            title={it.label}
          >
            <img
              alt={it.label}
              src={src}
              draggable={false}
              className={[
                'h-10 w-10 select-none object-contain',
                active ? 'opacity-100' : 'opacity-90',
              ].join(' ')}
            />
          </button>
        )
      })}
    </div>
  )
}


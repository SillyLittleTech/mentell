import { publicUrl } from '../shared/publicUrl'

export type SentimentValue = '+' | '-' | '='

const ITEMS: Array<{ value: SentimentValue; label: string; tone: 'pos' | 'mix' | 'neg' }> = [
  { value: '+', label: 'Positive', tone: 'pos' },
  { value: '=', label: 'Mixed', tone: 'mix' },
  { value: '-', label: 'Negative', tone: 'neg' },
]

function pillImage(value: SentimentValue) {
  if (value === '+') return publicUrl('/asset/pill_positive.png')
  if (value === '-') return publicUrl('/asset/pill_negative.png')
  return publicUrl('/asset/pill_mixed.png')
}

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
        return (
          <button
            key={it.value}
            type="button"
            className={[
              'sentiment-pill focus-ring',
              `sentiment-pill--${it.tone}`,
              active ? 'sentiment-pill--active' : '',
            ].join(' ')}
            aria-pressed={active}
            onClick={() => onChange(it.value)}
            title={it.label}
          >
            <img
              alt=""
              src={pillImage(it.value)}
              draggable={false}
              className="sentiment-pill__img"
              aria-hidden
            />
            <span className="sentiment-pill__glyph" aria-hidden>
              {it.value}
            </span>
          </button>
        )
      })}
    </div>
  )
}

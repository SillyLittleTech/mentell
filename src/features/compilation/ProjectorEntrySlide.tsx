import type { EntryRow } from '../../db/schema'
import { labelForEmotion, styleForSentiment } from './projectorEntryStyles'

export function ProjectorEntrySlide({
  entry,
  onClick,
}: {
  entry: Pick<
    EntryRow,
    'id' | 'dateKey' | 'sentiment' | 'situation' | 'emotion' | 'emotionNote' | 'warningLevel'
  >
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      className="focus-ring rounded-2xl border px-4 py-3 text-left hover:opacity-95"
      style={styleForSentiment(entry.sentiment)}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium">
          {entry.dateKey} <span className="font-mono">[{entry.sentiment}]</span>
        </div>
        {entry.warningLevel === 'warn' ? (
          <div className="rounded-xl border border-[var(--paper-border)] px-2 py-1 text-sm">
            <span style={{ color: 'var(--danger)' }}>!</span>
          </div>
        ) : null}
      </div>
      <div className="ink-muted mt-1 line-clamp-1 text-sm">{entry.situation || '—'}</div>
      <div className="ink-muted mt-1 text-xs">
        Emotion: {entry.emotionNote ? entry.emotionNote : labelForEmotion(entry.emotion)}
      </div>
    </button>
  )
}

export function ProjectorEntryDetail({
  entry,
}: {
  entry: Pick<
    EntryRow,
    | 'dateKey'
    | 'sentiment'
    | 'situation'
    | 'emotion'
    | 'emotionNote'
    | 'details'
    | 'warningLevel'
    | 'flaggedTerms'
  >
}) {
  return (
    <div className="grid gap-4">
      {entry.warningLevel === 'warn' ? (
        <div className="rounded-2xl border border-[var(--paper-border)] p-4">
          <div className="font-medium" style={{ color: 'var(--danger)' }}>
            Flagged terms: {entry.flaggedTerms?.join(', ') || '—'}
          </div>
          <div className="ink-muted mt-1 text-sm">
            If you’re in immediate danger or need urgent help, consider contacting local emergency
            services.
          </div>
        </div>
      ) : null}
      <div>
        <div className="ink-muted text-sm font-medium">Situation</div>
        <div className="mt-2 rounded-2xl border border-[var(--paper-border)] p-4 font-paper text-lg">
          {entry.situation || '—'}
        </div>
      </div>
      <div>
        <div className="ink-muted text-sm font-medium">Emotion</div>
        <div className="mt-2 rounded-2xl border border-[var(--paper-border)] p-4">
          {entry.emotionNote ? entry.emotionNote : labelForEmotion(entry.emotion)}
        </div>
      </div>
      <div>
        <div className="ink-muted text-sm font-medium">Details</div>
        <div className="mt-2 whitespace-pre-wrap rounded-2xl border border-[var(--paper-border)] p-4 font-paper text-lg leading-relaxed">
          {entry.details || '—'}
        </div>
      </div>
    </div>
  )
}

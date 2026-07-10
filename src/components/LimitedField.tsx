import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { MaterialIcon } from './MaterialIcon'

function formatCount(n: number) {
  return n.toLocaleString()
}

function OverLimitBadge({ count, max }: { count: number; max: number }) {
  return (
    <span
      className="pointer-events-none absolute bottom-2 right-3 font-mono text-[11px] font-medium tabular-nums"
      style={{ color: 'var(--danger)' }}
      aria-live="polite"
    >
      {formatCount(count)} / {formatCount(max)}
    </span>
  )
}

function WarningTriangle() {
  return (
    <span
      className="inline-flex items-center"
      style={{ color: 'var(--danger)' }}
      aria-label="Over character limit"
      role="img"
    >
      <MaterialIcon name="warning" accent={false} size={18} className="text-[var(--danger)]" />
    </span>
  )
}

export function LimitedFieldLabel({
  label,
  overLimit,
}: {
  label: string
  overLimit: boolean
}) {
  return (
    <div className="ink-muted flex items-center gap-1.5 text-sm font-medium">
      <span>{label}</span>
      {overLimit ? <WarningTriangle /> : null}
    </div>
  )
}

type LimitedInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> & {
  maxChars: number
  className?: string
}

export function LimitedInput({ maxChars, className = '', value, ...rest }: LimitedInputProps) {
  const text = typeof value === 'string' ? value : String(value ?? '')
  const over = text.length > maxChars
  return (
    <div className="relative">
      <input
        {...rest}
        value={value}
        aria-invalid={over || undefined}
        className={[
          'focus-ring w-full rounded-2xl border bg-transparent px-4 py-3 font-paper text-lg',
          over ? 'pr-24' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        style={{
          borderColor: over ? 'var(--danger)' : 'var(--paper-border)',
          ...(over ? { boxShadow: '0 0 0 1px var(--danger)' } : {}),
        }}
      />
      {over ? <OverLimitBadge count={text.length} max={maxChars} /> : null}
    </div>
  )
}

type LimitedTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> & {
  maxChars: number
  className?: string
}

export function LimitedTextarea({
  maxChars,
  className = '',
  value,
  ...rest
}: LimitedTextareaProps) {
  const text = typeof value === 'string' ? value : String(value ?? '')
  const over = text.length > maxChars
  return (
    <div className="relative">
      <textarea
        {...rest}
        value={value}
        aria-invalid={over || undefined}
        className={[
          'focus-ring w-full resize-y rounded-2xl border bg-transparent px-4 py-3 font-paper text-lg leading-relaxed',
          over ? 'pb-8' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        style={{
          borderColor: over ? 'var(--danger)' : 'var(--paper-border)',
          ...(over ? { boxShadow: '0 0 0 1px var(--danger)' } : {}),
        }}
      />
      {over ? <OverLimitBadge count={text.length} max={maxChars} /> : null}
    </div>
  )
}

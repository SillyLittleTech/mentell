/** Compact spinner used on submit and other brief waits. */
export function Throbber({
  label,
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 ${className ?? ''}`.trim()}
      role="status"
      aria-live="polite"
    >
      <span
        className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current/25 border-t-current"
        aria-hidden
      />
      {label ? <span>{label}</span> : <span className="sr-only">Loading</span>}
    </span>
  )
}

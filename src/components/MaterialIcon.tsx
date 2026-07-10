type MaterialIconProps = {
  name: string
  className?: string
  /** Defaults to var(--accent) */
  accent?: boolean
  size?: number
  title?: string
}

/** Material Symbols Outlined icon. Requires the font link in index.html. */
export function MaterialIcon({
  name,
  className = '',
  accent = true,
  size = 20,
  title,
}: MaterialIconProps) {
  return (
    <span
      className={`material-symbols-outlined select-none leading-none ${className}`}
      style={{
        fontSize: size,
        color: accent ? 'var(--accent)' : undefined,
        fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
      }}
      aria-hidden={title ? undefined : true}
      title={title}
    >
      {name}
    </span>
  )
}

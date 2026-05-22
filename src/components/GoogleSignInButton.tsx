import { GoogleGIcon } from './GoogleGIcon'

export function GoogleSignInButton({
  disabled,
  onClick,
  size = 'md',
}: {
  disabled?: boolean
  onClick: () => void
  size?: 'sm' | 'md'
}) {
  const dim = size === 'sm' ? 'h-9 w-9' : 'h-10 w-10'
  const icon = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'

  return (
    <button
      type="button"
      className={`focus-ring inline-flex ${dim} shrink-0 items-center justify-center rounded-full border border-[var(--paper-border)] bg-[var(--paper-bg)] shadow-sm transition hover:bg-[var(--pill-surface)] disabled:opacity-50`}
      disabled={disabled}
      aria-label="Sign in with Google"
      title="Sign in with Google"
      onClick={onClick}
    >
      <GoogleGIcon className={icon} />
    </button>
  )
}

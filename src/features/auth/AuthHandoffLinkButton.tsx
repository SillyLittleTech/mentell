import { Link } from 'react-router-dom'
import { isAuthHandoffConfigured } from '../../shared/firebase/authHandoffClient'
import { isAuthHandoffEnabled } from '../../shared/features/featureFlags'

/** Settings entry point for the hidden `/auth/link` page. */
export function AuthHandoffLinkButton() {
  if (!isAuthHandoffEnabled() || !isAuthHandoffConfigured()) return null

  return (
    <Link
      to="/auth/link"
      className="focus-ring inline-flex w-full items-center justify-center rounded-2xl border border-[var(--paper-border)] px-4 py-2.5 text-sm font-semibold"
    >
      Link accounts
    </Link>
  )
}

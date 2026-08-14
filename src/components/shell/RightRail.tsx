import { Link } from 'react-router-dom'
import { SpeechBubbleIcon } from '../SpeechBubbleIcon'
import { ThemeToggleButton } from '../ThemeToggleButton'
import { useTheme } from '../../shared/theme/useTheme'
import { AccountButton } from './AccountButton'

/** Desktop-only vertical rail in the right margin: account/sync, feedback, theme toggle. */
export function RightRail() {
  const { mode, toggle } = useTheme()

  return (
    <aside className="hidden md:sticky md:top-4 md:flex md:h-[calc(100svh-2rem)] md:w-16 md:flex-col md:items-center md:gap-2">
      <AccountButton />
      <Link
        to="/feedback"
        className="paper focus-ring flex h-12 w-12 items-center justify-center rounded-full"
        aria-label="Open feedback form"
        title="Feedback form"
      >
        <SpeechBubbleIcon className="h-5 w-5" />
      </Link>
      <ThemeToggleButton mode={mode} onToggle={toggle} className="rounded-full" />
    </aside>
  )
}

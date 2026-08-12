import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { MaterialIcon } from '../MaterialIcon'
import { SpeechBubbleIcon } from '../SpeechBubbleIcon'
import { ThemeToggleButton } from '../ThemeToggleButton'
import { useTheme } from '../../shared/theme/useTheme'
import { useAuthOptional } from '../../shared/firebase/AuthProvider'
import { listenToBackgroundActivity } from '../../shared/backgroundActivity'

/** Desktop-only vertical rail in the right margin: account/sync, feedback, theme toggle. */
export function RightRail() {
  const { mode, toggle } = useTheme()
  const auth = useAuthOptional()
  const [syncBusy, setSyncBusy] = useState(false)

  useEffect(() => {
    return listenToBackgroundActivity((event) => {
      if (event.id !== 'sync') return
      setSyncBusy(event.type === 'start')
    })
  }, [])

  const syncStatusTone = auth?.syncError
    ? 'var(--danger)'
    : syncBusy
      ? '#3b82f6'
      : auth?.user && auth.syncEnabled
        ? 'var(--success)'
        : 'rgba(148, 163, 184, 0.9)'

  return (
    <aside className="hidden md:sticky md:top-4 md:flex md:h-[calc(100svh-2rem)] md:w-16 md:flex-col md:items-center md:gap-2">
      <Link
        to="/settings#account-sync"
        className="paper focus-ring flex h-12 w-12 items-center justify-center rounded-full border border-[var(--paper-border)]"
        aria-label="Open account and sync settings"
        title="Account and sync"
        style={{
          color: syncStatusTone,
          boxShadow: `0 0 0 3px color-mix(in srgb, ${syncStatusTone} 25%, transparent), 0 0 22px color-mix(in srgb, ${syncStatusTone} 28%, transparent)`,
        }}
      >
        <MaterialIcon name="person" size={22} accent={false} />
      </Link>
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

import { Link } from 'react-router-dom'
import { MaterialIcon } from '../MaterialIcon'
import { useAuthOptional } from '../../shared/firebase/AuthProvider'
import { useBackgroundActivities } from '../../shared/useBackgroundActivities'
import { useState } from 'react'

export function AccountButton() {
  const auth = useAuthOptional()
  const activities = useBackgroundActivities()
  const [hover, setHover] = useState(false)

  const activeMessages = Object.values(activities)
  const isSyncBusy = 'sync' in activities

  const syncStatusTone = auth?.syncError
    ? 'var(--danger)'
    : isSyncBusy
      ? '#3b82f6'
      : auth?.user && auth.syncEnabled
        ? 'var(--success)'
        : 'rgba(148, 163, 184, 0.9)'

  return (
    <div
      className="relative flex items-center justify-center"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Link
        to="/settings#account-sync"
        className="paper focus-ring flex h-12 w-12 items-center justify-center rounded-full border border-[var(--paper-border)]"
        aria-label="Open account and sync settings"
        style={{
          color: syncStatusTone,
          boxShadow: `0 0 0 3px color-mix(in srgb, ${syncStatusTone} 25%, transparent), 0 0 22px color-mix(in srgb, ${syncStatusTone} 28%, transparent)`,
        }}
      >
        <MaterialIcon name="person" size={22} accent={false} />
      </Link>

      {hover && activeMessages.length > 0 && (
        <div className="absolute top-full mt-2 right-0 z-50 flex flex-col gap-2 pointer-events-none w-max">
          {activeMessages.map((msg, i) => (
            <div
              key={i}
              className="paper flex items-center gap-2 rounded-xl px-3 py-2 text-sm shadow-md animate-in fade-in slide-in-from-top-2"
            >
              <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
              {msg}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

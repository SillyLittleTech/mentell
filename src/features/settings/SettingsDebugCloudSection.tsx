import { isDebugMode } from '../../shared/debug/debugFlags'
import { isFirebaseEnabled, isFirebaseSyncEnabled } from '../../shared/features/featureFlags'
import { useAuthOptional } from '../../shared/firebase/AuthProvider'

export function SettingsDebugCloudSection() {
  if (!isDebugMode() || !isFirebaseEnabled()) return null

  const auth = useAuthOptional()
  if (!auth?.user) return null

  const label =
    auth.user.displayName === 'DEBUGGER' || auth.user.uid === 'DEBUGGER'
      ? 'DEBUGGER'
      : `DEBUGGER (${auth.user.uid.slice(0, 8)}…)`

  return (
    <section className="paper rounded-3xl p-6">
      <div className="font-paper text-xl">Debug cloud session</div>
      <p className="ink-muted mt-2 text-sm">
        Signed in as <span className="font-medium text-[var(--paper-ink)]">{label}</span>.
        Standard sign-in is disabled in debug builds; data syncs to a sandbox account, not your
        production Google user.
      </p>
      {isFirebaseSyncEnabled() && auth.syncEnabled ? (
        <p className="ink-muted mt-2 text-xs">Cloud sync is on for this debug session.</p>
      ) : null}
      {auth.syncError ? (
        <p className="mt-2 text-sm" style={{ color: 'var(--danger)' }}>
          {auth.syncError}
        </p>
      ) : null}
    </section>
  )
}

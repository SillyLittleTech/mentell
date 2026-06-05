import { useState } from 'react'
import { ConfirmTypeChallenge } from '../../components/ConfirmTypeChallenge'
import { clearLocalJournalData, deleteAccount } from '../../shared/account/accountDataService'
import { isFirebaseEnabled, isFirebaseSyncEnabled } from '../../shared/features/featureFlags'
import { useAuthOptional } from '../../shared/firebase/AuthProvider'
import { getEffectiveGlobalName } from '../../shared/settings/effectiveGlobalName'

type ModalKind = 'local' | 'account' | null

export function SettingsAccountFeatures() {
  const auth = useAuthOptional()
  const [modal, setModal] = useState<ModalKind>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  if (!isFirebaseEnabled() || !auth?.user) return null

  const challengeWord = getEffectiveGlobalName() || 'DELETE'
  const uid = auth.user.uid

  async function runLocalDelete() {
    setBusy(true)
    setActionError(null)
    try {
      await clearLocalJournalData()
      setModal(null)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not clear local data')
    } finally {
      setBusy(false)
    }
  }

  async function runAccountDelete() {
    if (!auth) return
    setBusy(true)
    setActionError(null)
    try {
      await deleteAccount(uid)
      setModal(null)
      await auth.signOut()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not delete account')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4 border-t border-[var(--paper-border)] pt-4">
      {isFirebaseSyncEnabled() ? (
        <label className="flex items-center justify-between gap-3 text-sm">
            <span>
              Disable cloud sync
              <span className="ink-muted block text-xs">
                Stops backup on this device until you use Sync now or sign in again.
              </span>
            </span>
            <input
              type="checkbox"
              className="h-5 w-5 shrink-0 accent-[var(--accent)]"
              checked={!auth.syncEnabled}
              onChange={(e) => void auth.setSyncEnabled(!e.target.checked)}
            />
          </label>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="focus-ring rounded-2xl border px-4 py-2 text-sm font-semibold"
          style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
          onClick={() => setModal('local')}
        >
          Delete local data
        </button>
        <button
          type="button"
          className="focus-ring rounded-2xl border px-4 py-2 text-sm font-semibold"
          style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
          onClick={() => setModal('account')}
        >
          Delete my account
        </button>
      </div>

      {actionError ? (
        <div className="mt-3 text-sm" style={{ color: 'var(--danger)' }}>
          {actionError}
        </div>
      ) : null}

      <ConfirmTypeChallenge
        open={modal === 'local'}
        title="Delete local data?"
        description="Removes journal entries, notes, stickies, packages, and score from this device. Your cloud copy remains; sync may restore data unless you disable sync or delete your account."
        challengeWord={challengeWord}
        confirmLabel="Delete local data"
        busy={busy}
        onCancel={() => setModal(null)}
        onConfirm={() => void runLocalDelete()}
      />

      <ConfirmTypeChallenge
        open={modal === 'account'}
        title="Delete your account?"
        description="Permanently removes your cloud journal backup, share links, and clears this device. Your Google account is not deleted, but Mentell data tied to this sign-in will be wiped."
        challengeWord={challengeWord}
        confirmLabel="Delete my account"
        busy={busy}
        onConfirm={() => void runAccountDelete()}
        onCancel={() => setModal(null)}
      />
    </div>
  )
}

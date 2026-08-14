import { format } from "date-fns";
import { isDebugMode } from "../../shared/debug/debugFlags";
import {
  isFirebaseEnabled,
  isFirebaseSyncEnabled,
  isAuthHandoffEnabled,
} from "../../shared/features/featureFlags";
import { useAuthOptional } from "../../shared/firebase/AuthProvider";
import { AuthHandoffLinkButton } from "../auth/AuthHandoffLinkButton";
import { isAuthHandoffConfigured } from "../../shared/firebase/authHandoffClient";
import { isFileProtocol, isOfflineZipBuild } from "../../shared/platform/runtime";
import { AccountSignInPanel } from "./AccountSignInPanel";
import { ScoreRecoverySection } from "./ScoreRecoverySection";
import { MaterialIcon } from "../../components/MaterialIcon";
import { useBackgroundActivities } from "../../shared/useBackgroundActivities";

export function AccountSyncSection() {
  const auth = useAuthOptional();
  const activities = useBackgroundActivities();
  const syncBusy = 'sync' in activities;

  if (isDebugMode()) return null;
  if (!isFirebaseEnabled()) return null;
  if (!auth) return null;
  const syncUi = isFirebaseSyncEnabled();
  const handoffUi =
    isAuthHandoffEnabled() &&
    isAuthHandoffConfigured() &&
    syncUi;
  const offlineHandoffOnly =
    handoffUi && (isOfflineZipBuild() || isFileProtocol());

  return (
    <section id="account-sync" className="paper rounded-3xl p-6">
      <div className="font-paper text-xl">Account &amp; sync</div>
      <div className="ink-muted mt-1 text-sm">
        Sign in to back up and sync your journal across devices.
      </div>

      {auth.loading ? (
        <div className="ink-muted mt-4 text-sm">Checking sign-in…</div>
      ) : auth.user ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-[var(--paper-border)] px-4 py-3 text-sm">
            Signed in as{" "}
            <span className="font-medium">
              {auth.user.email ?? auth.user.uid}
            </span>
            {syncUi && auth.syncEnabled ? (
              <div className="ink-muted mt-1 text-xs">Cloud sync is on.</div>
            ) : syncUi ? (
              <div className="ink-muted mt-1 text-xs">
                Cloud sync is off (see Features).
              </div>
            ) : null}
          </div>

          {syncUi ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="focus-ring rounded-2xl border border-[var(--paper-border)] px-4 py-2 text-sm font-semibold disabled:opacity-60"
                  disabled={syncBusy}
                  onClick={() => {
                    void auth.syncNow();
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <MaterialIcon
                      name="sync"
                      size={20}
                      accent={false}
                      className="text-[var(--paper-ink)] opacity-85"
                    />
                    {syncBusy ? "Syncing…" : "Sync now"}
                  </span>
                </button>
                <button
                  type="button"
                  className="focus-ring rounded-2xl border border-[var(--paper-border)] px-4 py-2 text-sm disabled:opacity-60"
                  disabled={syncBusy}
                  onClick={() => void auth.signOut()}
                >
                  <span className="inline-flex items-center gap-2">
                    <MaterialIcon
                      name="logout"
                      size={20}
                      accent={false}
                      className="text-[var(--paper-ink)] opacity-85"
                    />
                    Sign out
                  </span>
                </button>
              </div>

              {auth.lastSyncedAt ? (
                <div className="ink-muted text-xs">
                  Last synced {format(auth.lastSyncedAt, "PPp")}
                </div>
              ) : null}
              {auth.syncError ? (
                <div className="text-sm" style={{ color: "var(--danger)" }}>
                  {auth.syncError}
                </div>
              ) : null}
              <ScoreRecoverySection />
              {handoffUi ? <AuthHandoffLinkButton /> : null}
            </>
          ) : (
            <button
              type="button"
              className="focus-ring rounded-2xl border border-[var(--paper-border)] px-4 py-2 text-sm"
              onClick={() => void auth.signOut()}
            >
              <span className="inline-flex items-center gap-2">
                <MaterialIcon
                  name="logout"
                  size={20}
                  accent={false}
                  className="text-[var(--paper-ink)] opacity-85"
                />
                Sign out
              </span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm">
            {offlineHandoffOnly
              ? "Link this copy to your cloud account with a one-time code from the hosted Mentell app."
              : "Sign in to sync entries, notes, score, and settings across devices."}
          </p>
          {handoffUi ? <AuthHandoffLinkButton /> : null}
          {syncUi && !offlineHandoffOnly ? <AccountSignInPanel /> : null}
          {!syncUi ? (
            <div className="ink-muted text-xs">
              Cloud synchronization is currently unavailable (EC101).
            </div>
          ) : null}
          {auth.syncError ? (
            <div className="text-sm" style={{ color: "var(--danger)" }}>
              {auth.syncError}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

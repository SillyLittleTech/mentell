import { format } from "date-fns";
import { useState } from "react";
import { isDebugMode } from "../../shared/debug/debugFlags";
import {
  isFirebaseEnabled,
  isFirebaseSyncEnabled,
} from "../../shared/features/featureFlags";
import { useAuthOptional } from "../../shared/firebase/AuthProvider";
import { AccountSignInPanel } from "./AccountSignInPanel";
import {
  AuthHandoffCreateSection,
  AuthHandoffRedeemSection,
} from "./AuthHandoffSection";
import { ScoreRecoverySection } from "./ScoreRecoverySection";

export function AccountSyncSection() {
  const auth = useAuthOptional();
  const [syncBusy, setSyncBusy] = useState(false);

  if (isDebugMode()) return null;
  if (!isFirebaseEnabled()) return null;
  if (!auth) return null;
  const syncUi = isFirebaseSyncEnabled();

  return (
    <section className="paper rounded-3xl p-6">
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
                    setSyncBusy(true);
                    void auth.syncNow().finally(() => setSyncBusy(false));
                  }}
                >
                  {syncBusy ? "Syncing…" : "Sync now"}
                </button>
                <button
                  type="button"
                  className="focus-ring rounded-2xl border border-[var(--paper-border)] px-4 py-2 text-sm disabled:opacity-60"
                  disabled={syncBusy}
                  onClick={() => void auth.signOut()}
                >
                  Sign out
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
              <AuthHandoffCreateSection />
            </>
          ) : (
            <button
              type="button"
              className="focus-ring rounded-2xl border border-[var(--paper-border)] px-4 py-2 text-sm"
              onClick={() => void auth.signOut()}
            >
              Sign out
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm">
            Sign in to sync entries, notes, score, and settings across devices.
          </p>
          <AuthHandoffRedeemSection />
          {syncUi ? (
            <AccountSignInPanel />
          ) : (
            <div className="ink-muted text-xs">
              Sync flag is off in this build.
            </div>
          )}
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

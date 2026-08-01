import {
  onAuthStateChanged,
  signInWithCustomToken,
  signOut as firebaseSignOut,
  type Auth,
} from "firebase/auth";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  isFirebaseEnabled,
  isFirebaseSyncEnabled,
} from "../features/featureFlags";
import { isDebugMode } from "../debug/debugFlags";
import { AuthContext, type AuthContextValue } from "./authContext";
import { getFirebaseAuth } from "./firebaseApp";
import { enableSync, disableSync } from "../sync/syncService";
import { loadSyncState, saveSyncState } from "../sync/syncState";

function authDisabled(): Promise<void> {
  return Promise.reject(new Error("Sign-in is disabled in debug builds"));
}

async function ensureDebuggerSession(auth: Auth) {
  await firebaseSignOut(auth);
  const token = import.meta.env.VITE_DEBUG_FIREBASE_CUSTOM_TOKEN?.trim();
  if (!token)
    throw new Error("Debug cloud is disabled without a DEBUGGER custom token");
  await signInWithCustomToken(auth, token);
}

export function DebugAuthProvider({ children }: { children: ReactNode }) {
  const enabled = isFirebaseEnabled() && isDebugMode();
  const [user, setUser] = useState<AuthContextValue["user"]>(null);
  const [loading, setLoading] = useState(enabled);
  const [syncEnabled, setSyncEnabledState] = useState(
    () => loadSyncState().enabled,
  );
  const [syncError, setSyncError] = useState<string | null>(
    loadSyncState().lastError,
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(
    loadSyncState().lastSyncedAt,
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        await ensureDebuggerSession(auth);
        if (cancelled) return;
        if (isFirebaseSyncEnabled()) {
          const uid = auth.currentUser?.uid;
          if (uid) {
            await enableSync(uid);
            saveSyncState({ enabled: true });
            setSyncEnabledState(true);
            const s = loadSyncState();
            setSyncError(s.lastError);
            setLastSyncedAt(s.lastSyncedAt);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setSyncError(e instanceof Error ? e.message : "Debug sign-in failed");
        }
      }
    })();

    const unsub = onAuthStateChanged(auth, (next) => {
      setUser(next);

      setLoading(false);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [enabled]);

  const signOut = useCallback(async () => {
    disableSync();
    saveSyncState({ enabled: false });
    setSyncEnabledState(false);
    const auth = getFirebaseAuth();
    if (auth) await firebaseSignOut(auth);
    setUser(null);
  }, []);

  const setSyncEnabled = useCallback(
    async (on: boolean) => {
      if (!user) throw new Error("Debug session not ready");
      if (on) {
        await enableSync(user.uid);
        saveSyncState({ enabled: true });
        setSyncEnabledState(true);
      } else {
        disableSync();
        saveSyncState({ enabled: false });
        setSyncEnabledState(false);
      }
      const s = loadSyncState();
      setSyncError(s.lastError);
      setLastSyncedAt(s.lastSyncedAt);
    },
    [user],
  );

  const syncNow = useCallback(async () => {
    if (!user) throw new Error("Debug session not ready");
    await enableSync(user.uid, { forcePush: true });
    const s = loadSyncState();
    setSyncEnabledState(true);
    setSyncError(s.lastError);
    setLastSyncedAt(s.lastSyncedAt);
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      enabled,
      user,
      loading,
      syncEnabled,
      syncError,
      lastSyncedAt,
      emailLinkSent: false,
      pendingEmailLinkConfirm: false,
      signInWithGoogle: authDisabled,
      signInWithEmailPassword: authDisabled,
      createAccountWithEmailPassword: authDisabled,
      sendPasswordReset: authDisabled,
      sendSignInLink: authDisabled,
      confirmEmailLinkSignIn: authDisabled,
      signOut,
      setSyncEnabled,
      syncNow,
    }),
    [
      enabled,
      user,
      loading,
      syncEnabled,
      syncError,
      lastSyncedAt,
      signOut,
      setSyncEnabled,
      syncNow,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

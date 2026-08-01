import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signInWithPopup,
  signOut as firebaseSignOut,
  type Auth,
  type User,
} from "firebase/auth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isFirebaseEnabled,
  isFirebaseSyncEnabled,
} from "../features/featureFlags";
import { formatAuthError } from "./authErrors";
import { getOAuthRedirectUri } from "./config";
import {
  clearEmailLinkUrl,
  clearStoredEmailForSignIn,
  getEmailLinkActionCodeSettings,
  readStoredEmailForSignIn,
  storeEmailForSignIn,
} from "./emailLinkAuth";
import { getFirebaseAuth } from "./firebaseApp";
import { finishSignIn } from "./postSignIn";
import { disableSync, enableSync } from "../sync/syncService";
import { loadSyncState, saveSyncState } from "../sync/syncState";
import { AuthContext, type AuthContextValue } from "./authContext";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const enabled = isFirebaseEnabled();
  const [user, setUser] = useState<User | null>(null);
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
  const [emailLinkSent, setEmailLinkSent] = useState(false);
  const [pendingEmailLinkConfirm, setPendingEmailLinkConfirm] = useState(false);
  const emailLinkHandled = useRef(false);

  const postSignInCallbacks = useMemo(
    () => ({
      setSyncEnabled: setSyncEnabledState,
      setSyncError,
      setLastSyncedAt,
    }),
    [],
  );

  const applyAuthUser = useCallback((auth: Auth) => {
    setUser(auth.currentUser);

    setLoading(false);
  }, []);

  const completeEmailLinkSignIn = useCallback(
    async (email: string) => {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error("Cloud sign-in is not configured");
      await signInWithEmailLink(auth, email.trim(), window.location.href);
      applyAuthUser(auth);
      clearStoredEmailForSignIn();
      clearEmailLinkUrl();
      setPendingEmailLinkConfirm(false);
      await finishSignIn(auth, postSignInCallbacks);
    },
    [applyAuthUser, postSignInCallbacks],
  );

  useEffect(() => {
    if (!enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth) {
      setLoading(false);
      return;
    }

    if (
      !emailLinkHandled.current &&
      isSignInWithEmailLink(auth, window.location.href)
    ) {
      emailLinkHandled.current = true;
      const stored = readStoredEmailForSignIn();
      if (stored) {
        void completeEmailLinkSignIn(stored).catch((e) => {
          setSyncError(formatAuthError(e));
        });
      } else {
        setPendingEmailLinkConfirm(true);
      }
    }

    applyAuthUser(auth);

    return onAuthStateChanged(auth, async (next) => {
      setUser(next);

      setLoading(false);
      if (next && isFirebaseSyncEnabled() && loadSyncState().enabled) {
        try {
          await enableSync(next.uid);
          const s = loadSyncState();
          setSyncEnabledState(true);
          setSyncError(s.lastError);
          setLastSyncedAt(s.lastSyncedAt);
        } catch (e) {
          setSyncError(e instanceof Error ? e.message : "Sync failed");
        }
      } else if (!next) {
        disableSync();
        setSyncEnabledState(false);
      }
    });
  }, [enabled, applyAuthUser, completeEmailLinkSignIn]);

  const signInWithGoogle = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error("Cloud sign-in is not configured");
    const redirectUri = getOAuthRedirectUri();
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      applyAuthUser(auth);
      await finishSignIn(auth, postSignInCallbacks);
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const mismatch =
        raw.includes("redirect_uri_mismatch") || raw.includes("redirect_uri");
      const hint =
        mismatch && redirectUri
          ? `Google OAuth redirect URI mismatch. In Google Cloud → Credentials → OAuth Web client, add Authorized redirect URI: ${redirectUri}`
          : formatAuthError(e);
      setSyncError(hint);
      throw new Error(hint, { cause: e });
    }
  }, [applyAuthUser, postSignInCallbacks]);

  const signInWithEmailPassword = useCallback(
    async (email: string, password: string) => {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error("Cloud sign-in is not configured");
      try {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        applyAuthUser(auth);
        await finishSignIn(auth, postSignInCallbacks);
      } catch (e) {
        const hint = formatAuthError(e);
        setSyncError(hint);
        throw new Error(hint, { cause: e });
      }
    },
    [applyAuthUser, postSignInCallbacks],
  );

  const createAccountWithEmailPassword = useCallback(
    async (email: string, password: string) => {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error("Cloud sign-in is not configured");
      try {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
        applyAuthUser(auth);
        await finishSignIn(auth, postSignInCallbacks);
      } catch (e) {
        const hint = formatAuthError(e);
        setSyncError(hint);
        throw new Error(hint, { cause: e });
      }
    },
    [applyAuthUser, postSignInCallbacks],
  );

  const sendPasswordReset = useCallback(async (email: string) => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error("Cloud sign-in is not configured");
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSyncError(null);
    } catch (e) {
      const hint = formatAuthError(e);
      setSyncError(hint);
      throw new Error(hint, { cause: e });
    }
  }, []);

  const sendSignInLink = useCallback(async (email: string) => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error("Cloud sign-in is not configured");
    try {
      storeEmailForSignIn(email);
      await sendSignInLinkToEmail(
        auth,
        email.trim(),
        getEmailLinkActionCodeSettings(),
      );
      setEmailLinkSent(true);
      setSyncError(null);
    } catch (e) {
      const hint = formatAuthError(e);
      setSyncError(hint);
      throw new Error(hint, { cause: e });
    }
  }, []);

  const confirmEmailLinkSignIn = useCallback(
    async (email: string) => {
      try {
        await completeEmailLinkSignIn(email);
      } catch (e) {
        const hint = formatAuthError(e);
        setSyncError(hint);
        throw new Error(hint, { cause: e });
      }
    },
    [completeEmailLinkSignIn],
  );

  const signOut = useCallback(async () => {
    disableSync();
    saveSyncState({ enabled: false });
    setSyncEnabledState(false);
    setEmailLinkSent(false);
    setPendingEmailLinkConfirm(false);
    const auth = getFirebaseAuth();
    if (auth) await firebaseSignOut(auth);
  }, []);

  const setSyncEnabled = useCallback(
    async (on: boolean) => {
      if (!user) throw new Error("Sign in first");
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
    if (!user) throw new Error("Sign in first");
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
      emailLinkSent,
      pendingEmailLinkConfirm,
      signInWithGoogle,
      signInWithEmailPassword,
      createAccountWithEmailPassword,
      sendPasswordReset,
      sendSignInLink,
      confirmEmailLinkSignIn,
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
      emailLinkSent,
      pendingEmailLinkConfirm,
      signInWithGoogle,
      signInWithEmailPassword,
      createAccountWithEmailPassword,
      sendPasswordReset,
      sendSignInLink,
      confirmEmailLinkSignIn,
      signOut,
      setSyncEnabled,
      syncNow,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export { useAuth, useAuthOptional } from "./authContext";

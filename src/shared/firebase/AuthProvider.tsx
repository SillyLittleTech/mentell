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
import { isFirebaseEnabled, isFirebaseSyncEnabled } from "../features/featureFlags";
import { isTauri } from "../platform/runtime";
import { formatAuthError } from "./authErrors";
import {
  getHostedSignInUrl,
  supportsInAppGoogleSignIn,
} from "./authCapabilities";
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
import { buildHrefForEmailLinkCheck } from "./emailLinkHandoff";
import { AuthContext, type AuthContextValue } from "./authContext";
import { signInWithGoogleViaTauri } from "./tauriGoogleAuth";
import { redeemAuthHandoffCode as redeemHandoffToken } from "./authHandoffClient";
import { installTauriDeepLinkAuth } from "./tauriDeepLinkAuth";
import {
  buildTauriEmailLinkSettings,
  waitForTauriEmailLinkCompletion,
} from "./tauriEmailLink";

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
    async (email: string, linkUrl?: string) => {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error("Cloud sign-in is not configured");
      const link = linkUrl ?? window.location.href;
      await signInWithEmailLink(auth, email.trim(), link);
      applyAuthUser(auth);
      clearStoredEmailForSignIn();
      clearEmailLinkUrl();
      setPendingEmailLinkConfirm(false);
      await finishSignIn(auth, postSignInCallbacks);
    },
    [applyAuthUser, postSignInCallbacks],
  );

  const handleIncomingEmailLink = useCallback(
    (linkUrl: string) => {
      if (emailLinkHandled.current) return;
      emailLinkHandled.current = true;
      const stored = readStoredEmailForSignIn();
      if (stored) {
        void completeEmailLinkSignIn(stored, linkUrl).catch((e) => {
          emailLinkHandled.current = false;
          setSyncError(formatAuthError(e));
        });
      } else {
        setPendingEmailLinkConfirm(true);
        try {
          sessionStorage.setItem('mentell.pendingEmailLink', linkUrl);
        } catch {
          // ignore quota errors
        }
      }
    },
    [completeEmailLinkSignIn],
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

    let removeDeepLinkListener: (() => void) | undefined

    void installTauriDeepLinkAuth(auth, handleIncomingEmailLink).then((unlisten) => {
      removeDeepLinkListener = unlisten
    })

    if (
      !emailLinkHandled.current &&
      isSignInWithEmailLink(auth, buildHrefForEmailLinkCheck())
    ) {
      handleIncomingEmailLink(buildHrefForEmailLinkCheck());
    }

    applyAuthUser(auth);

    const unsubscribeAuth = onAuthStateChanged(auth, async (next) => {
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

    return () => {
      removeDeepLinkListener?.()
      unsubscribeAuth()
    }
  }, [enabled, applyAuthUser, handleIncomingEmailLink]);

  const signInWithGoogle = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error("Cloud sign-in is not configured");
    const redirectUri = getOAuthRedirectUri();
    try {
      if (!supportsInAppGoogleSignIn()) {
        window.open(getHostedSignInUrl(), "_blank", "noopener,noreferrer");
        throw new Error(
          "Google sign-in opened in your browser. Use the hosted Mentell app or desktop app to connect cloud backup.",
        );
      }
      if (isTauri()) {
        await signInWithGoogleViaTauri(auth);
        applyAuthUser(auth);
        await finishSignIn(auth, postSignInCallbacks);
        return;
      }
      const provider = new GoogleAuthProvider();
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
      if (isTauri()) {
        const { settings, waitForLink } = await buildTauriEmailLinkSettings();
        const linkPromise = waitForLink();
        await sendSignInLinkToEmail(auth, email.trim(), settings);
        setEmailLinkSent(true);
        setSyncError(null);
        void waitForTauriEmailLinkCompletion(auth, linkPromise)
          .then((link) => completeEmailLinkSignIn(email, link))
          .catch((e) => {
            setSyncError(formatAuthError(e));
          });
        return;
      }
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
  }, [completeEmailLinkSignIn]);

  const confirmEmailLinkSignIn = useCallback(
    async (email: string) => {
      try {
        const pendingLink = sessionStorage.getItem('mentell.pendingEmailLink') ?? undefined;
        await completeEmailLinkSignIn(email, pendingLink);
        sessionStorage.removeItem('mentell.pendingEmailLink');
      } catch (e) {
        const hint = formatAuthError(e);
        setSyncError(hint);
        throw new Error(hint, { cause: e });
      }
    },
    [completeEmailLinkSignIn],
  );

  const redeemHandoffCode = useCallback(
    async (code: string) => {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error("Cloud sign-in is not configured");
      try {
        await redeemHandoffToken(code, postSignInCallbacks);
        applyAuthUser(auth);
        setSyncError(null);
      } catch (e) {
        const hint = formatAuthError(e);
        setSyncError(hint);
        throw new Error(hint, { cause: e });
      }
    },
    [applyAuthUser, postSignInCallbacks],
  );

  const signOut = useCallback(async () => {
    disableSync();
    saveSyncState({ enabled: false });
    setSyncEnabledState(false);
    setEmailLinkSent(false);
    setPendingEmailLinkConfirm(false);
    sessionStorage.removeItem('mentell.pendingEmailLink');
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
      redeemHandoffCode,
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
      redeemHandoffCode,
      signOut,
      setSyncEnabled,
      syncNow,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export { useAuth, useAuthOptional } from "./authContext";

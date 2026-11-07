import { isDebugMode } from "../debug/debugFlags";
import { isTauri } from "../platform/runtime";

function envFlag(name: string) {
  return import.meta.env[name] === "1";
}

function hasFirebaseConfig() {
  return Boolean(import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim());
}

function hasDebugFirebaseToken() {
  return Boolean(import.meta.env.VITE_DEBUG_FIREBASE_CUSTOM_TOKEN?.trim());
}

/** Debug builds normally use DebugAuthProvider; Tauri/auth-testing uses real AuthProvider. */
export function shouldUseDebugAuthProvider(): boolean {
  return isDebugMode() && !isTauri() && !envFlag("VITE_DEBUG_ENABLE_AUTH");
}

export function isFirebaseEnabled() {
  if (!envFlag("VITE_ENABLE_FIREBASE")) return false;
  if (shouldUseDebugAuthProvider() && !hasDebugFirebaseToken()) {
    if (import.meta.env.DEV) {
      console.warn(
        "[mentell] Debug Firebase is disabled without VITE_DEBUG_FIREBASE_CUSTOM_TOKEN. " +
          "Set VITE_DEBUG_ENABLE_AUTH=1 or use npm run dev / tauri dev for real sign-in testing.",
      );
    }
    return false;
  }
  if (!hasFirebaseConfig()) {
    if (import.meta.env.DEV) {
      console.warn(
        "[mentell] VITE_ENABLE_FIREBASE=1 but Firebase config is incomplete",
      );
    }
    return false;
  }
  return true;
}

export function isFirebaseSyncEnabled() {
  return isFirebaseEnabled() && envFlag("VITE_ENABLE_FIREBASE_SYNC");
}

export function isShareLinksEnabled() {
  return isFirebaseEnabled() && envFlag("VITE_ENABLE_SHARE_LINKS");
}

/** Offline ↔ web account linking via one-time codes (requires Worker + service account). */
export function isAuthHandoffEnabled() {
  return isFirebaseEnabled() && envFlag("VITE_ENABLE_AUTH_HANDOFF");
}

/** 2.x sustained-risk (ema_rma_heat) + hypermania feedback; set `VITE_DISABLE_RISK_HEAT_V2=1` to disable. */
export function isRiskHeatV2Enabled() {
  return import.meta.env.VITE_DISABLE_RISK_HEAT_V2 !== "1";
}

/** Settings / dev tools: show the auth diagnostics panel. */
export function isAuthDebugPanelEnabled(): boolean {
  if (isDebugMode()) return true;
  if (isTauri() && import.meta.env.DEV) return true;
  try {
    return window.localStorage.getItem("mentell.debug.authPanel") === "1";
  } catch {
    return false;
  }
}

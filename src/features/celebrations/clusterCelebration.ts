/**
 * Cluster celebration + comeback toast state (localStorage).
 * Internal: cluster_celebration, comeback_toast
 */

import { scopedStorageKey } from "../../shared/storage/storageScope";

const CLUSTER_PREFIX = scopedStorageKey("mentell.v2.clusterCelebration.");
const COMEBACK_KEY = scopedStorageKey("mentell.v2.comebackToast.last");

export type ClusterMilestone = "hbcm_peak" | "consistency_week";

export type ClusterCelebrationPayload = {
  milestone: ClusterMilestone;
  hbcmDisplay: number;
  at: number;
};

export type ComebackPayload = {
  gapDays: number;
  at: number;
};

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function recordClusterCelebration(payload: ClusterCelebrationPayload) {
  localStorage.setItem(
    `${CLUSTER_PREFIX}${payload.milestone}`,
    String(payload.at),
  );
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("mentell:cluster_celebration", { detail: payload }),
    );
  }
}

export function shouldShowClusterCelebration(
  milestone: ClusterMilestone,
  cooldownMs: number,
): boolean {
  const key = `${CLUSTER_PREFIX}${milestone}`;
  const lastAt = Number(localStorage.getItem(key));
  if (!Number.isFinite(lastAt)) return true;
  return Date.now() - lastAt > cooldownMs;
}

export function recordComebackToast(payload: ComebackPayload) {
  localStorage.setItem(COMEBACK_KEY, JSON.stringify(payload));
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("mentell:comeback_toast", { detail: payload }),
    );
  }
}

export function shouldShowComeback(cooldownMs: number): boolean {
  const last = readJson<ComebackPayload>(COMEBACK_KEY);
  if (!last?.at) return true;
  return Date.now() - last.at > cooldownMs;
}

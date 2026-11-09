import type { ReactNode } from "react";
import { SyncOnboardingBanner } from "../settings/SyncOnboardingBanner";

/** Grey-out overlay + sync sign-in banner over compose UI (quick log, entry, or chooser). */
export function ComposerLockShell({
  locked,
  shakeKey,
  onBlockedInteraction,
  children,
}: {
  locked: boolean;
  shakeKey: number;
  onBlockedInteraction: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="relative"
      onPointerDownCapture={locked ? onBlockedInteraction : undefined}
    >
      {locked ? (
        <div className="absolute inset-x-0 top-32 z-20 sm:top-36">
          <SyncOnboardingBanner shakeKey={shakeKey} mode="overlay" />
        </div>
      ) : null}
      {locked ? (
        <div
          className="absolute inset-0 z-10 cursor-not-allowed"
          aria-hidden
          onFocus={onBlockedInteraction}
        />
      ) : null}
      {children}
    </div>
  );
}

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type {
  ClusterCelebrationPayload,
  ComebackPayload,
} from "./clusterCelebration";
import { ConfettiBurst } from "./ConfettiBurst";
import { HbcmDisplay } from "../score/HbcmDisplay";
import { getScoreSnapshot } from "../score/scoreService";
import {
  motionDuration,
  shouldReduceMotion,
} from "../../shared/motion/useMotionPrefs";

/** `CelebrationLayer` — see module for behavior. */
export function CelebrationLayer() {
  const reduced = shouldReduceMotion();
  const [cluster, setCluster] = useState<ClusterCelebrationPayload | null>(
    null,
  );
  const [comeback, setComeback] = useState<ComebackPayload | null>(null);

  useEffect(() => {
    const onCluster = (e: Event) => {
      const d = (e as CustomEvent<ClusterCelebrationPayload>).detail;
      if (d) setCluster(d);
    };
    const onComeback = (e: Event) => {
      const d = (e as CustomEvent<ComebackPayload>).detail;
      if (d) setComeback(d);
    };
    window.addEventListener("mentell:cluster_celebration", onCluster);
    window.addEventListener("mentell:comeback_toast", onComeback);
    return () => {
      window.removeEventListener("mentell:cluster_celebration", onCluster);
      window.removeEventListener("mentell:comeback_toast", onComeback);
    };
  }, []);

  useEffect(() => {
    if (!comeback) return;
    const t = window.setTimeout(() => setComeback(null), 5200);
    return () => window.clearTimeout(t);
  }, [comeback]);

  return (
    <>
      <AnimatePresence>
        {cluster ? (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Consistency celebration"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduced ? undefined : { opacity: 0 }}
            transition={{ duration: motionDuration(0.2) || 0 }}
          >
            <ConfettiBurst burstKey={cluster.at} />
            <motion.div
              className="paper relative z-10 max-w-md rounded-3xl p-6 shadow-xl"
              initial={reduced ? false : { scale: 0.94 }}
              animate={{ scale: 1 }}
              exit={reduced ? undefined : { scale: 0.96 }}
            >
              <div className="font-paper text-2xl">Nice consistency</div>
              <p className="ink-muted mt-2 text-sm">
                Your heat-based consistency reached{" "}
                <span className="font-mono font-bold">
                  {cluster.hbcmDisplay}
                </span>{" "}
                — that takes care in real life, not just calendar luck.
              </p>
              <div className="mt-5 flex justify-center">
                <div className="origin-center scale-[1.4]">
                  <HbcmDisplay
                    hbcmDisplay={cluster.hbcmDisplay}
                    logStreak={getScoreSnapshot().logStreak}
                    pulse={!reduced}
                    variant="chip"
                  />
                </div>
              </div>
              <button
                type="button"
                className="btn-primary focus-ring mt-5 w-full rounded-2xl py-3 text-sm font-semibold"
                onClick={() => setCluster(null)}
              >
                Continue
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="pointer-events-none fixed bottom-6 left-1/2 z-[75] w-[min(92vw,24rem)] -translate-x-1/2">
        <AnimatePresence>
          {comeback ? (
            <motion.div
              role="status"
              aria-live="polite"
              className="paper rounded-2xl border border-[var(--paper-border)] px-4 py-3 text-sm shadow-lg"
              initial={reduced ? false : { y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reduced ? undefined : { y: 8, opacity: 0 }}
            >
              <span className="font-medium">Welcome back</span>
              <span className="ink-muted">
                {" "}
                — after a longer pause, logging again matters.
              </span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </>
  );
}

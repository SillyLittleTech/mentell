import { motion } from "framer-motion";
import { isDebugMode } from "../../shared/debug/debugFlags";
import { useBodyScrollLock } from "../../shared/motion/useBodyScrollLock";
import {
  motionDuration,
  shouldReduceMotion,
} from "../../shared/motion/useMotionPrefs";
import { CrisisResourcePanel } from "./CrisisResourcePanel";
import type { RiskAssessment } from "./riskAssessment";

/** Whether post-submit UI should surface a supportive or crisis modal. */
export function shouldShowPostSubmitRiskModal(risk: RiskAssessment): boolean {
  return (
    risk.responseKind === "crisis" ||
    (risk.responseKind !== "none" && Boolean(risk.supportiveMessage?.trim()))
  );
}

function SupportNotice({ risk }: { risk: RiskAssessment }) {
  const celebration = risk.responseKind === "positive";
  const hyper = risk.responseKind === "hypermania";
  const message = risk.supportiveMessage?.trim();
  return (
    <div className="space-y-2">
      <div
        className="font-medium"
        style={{
          color: hyper ? "var(--accent)" : "var(--success)",
        }}
      >
        {hyper
          ? "A gentle pace check"
          : celebration
            ? "This deserves a little confetti"
            : "A small note for this moment"}
      </div>
      {message ? <div>{message}</div> : null}
      {isDebugMode() ? <RiskSignalLine risk={risk} /> : null}
    </div>
  );
}

function RiskNotice({ risk }: { risk: RiskAssessment }) {
  const crisis = risk.responseKind === "crisis";
  return (
    <div className="space-y-2">
      <div className="font-medium" style={{ color: "var(--danger)" }}>
        {crisis
          ? "You matter, and you do not have to sit with this alone."
          : "I noticed this feels heavy. You are cared about."}
      </div>
      {risk.supportiveMessage?.trim() ? (
        <div>{risk.supportiveMessage}</div>
      ) : null}
      {isDebugMode() ? <RiskSignalLine risk={risk} /> : null}
      {isDebugMode() && risk.reasons.length ? (
        <div>Signals: {risk.reasons.join(", ")}</div>
      ) : null}
      {crisis || risk.responseKind === "support" ? (
        <CrisisResourcePanel compact risk={risk} />
      ) : null}
    </div>
  );
}

function RiskSignalLine({ risk }: { risk: RiskAssessment }) {
  const guard =
    risk.guardSafe === undefined
      ? ""
      : ` · guard ${risk.guardSafe ? "safe" : "unsafe"}`;
  return (
    <div className="font-mono text-[11px] uppercase opacity-70">
      Literal {risk.literalSentimentLabel}{" "}
      {risk.literalSentimentConfidence.toFixed(2)} (
      {risk.literalSentimentScore.toFixed(2)}) · {risk.sentimentModelSource} ·{" "}
      {risk.source}
      {guard}
    </div>
  );
}

function riskResultModalTitle(kind: RiskAssessment["responseKind"]): string {
  if (kind === "crisis") return "You are not alone";
  if (kind === "hypermania") return "Energy check-in";
  if (kind === "positive") return "Look at you go";
  return "A note for you";
}

function riskResultModalSubtitle(kind: RiskAssessment["responseKind"]): string {
  if (kind === "crisis") {
    return "Mentell noticed this entry may need extra care.";
  }
  if (kind === "hypermania") {
    return "Mentell noticed unusually intense upbeat language across recent logs. This is not a diagnosis — just a nudge to notice pace and sleep.";
  }
  if (kind === "positive") {
    return "Mentell noticed a bright patch worth celebrating.";
  }
  return "Mentell found a supportive note after reading your entry.";
}

/** Full-screen modal after submit when risk review warrants extra care. */
export function RiskResultModal({
  risk,
  onClose,
}: {
  risk: RiskAssessment;
  onClose: () => void;
}) {
  const crisis = risk.responseKind === "crisis";
  const titleId = "risk-result-modal-title";
  const reduced = shouldReduceMotion();
  useBodyScrollLock(true);
  return (
    <motion.div
      className="fixed inset-0 z-50 touch-pan-y overflow-y-auto overscroll-y-contain bg-black/35 p-4 pb-10 sm:p-6 sm:pb-12"
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduced ? undefined : { opacity: 0 }}
      transition={{ duration: motionDuration(0.2) || 0 }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="paper mx-auto my-6 w-full max-w-xl rounded-3xl p-6 shadow-lg sm:my-10"
        initial={reduced ? false : { scale: 0.96, y: 18 }}
        animate={{ scale: 1, y: 0 }}
        exit={reduced ? undefined : { scale: 0.98, y: 10 }}
        transition={{ duration: motionDuration(0.25) || 0 }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div id={titleId} className="font-paper text-2xl">
              {riskResultModalTitle(risk.responseKind)}
            </div>
            <div className="ink-muted mt-1 text-sm">
              {riskResultModalSubtitle(risk.responseKind)}
            </div>
          </div>
          <button
            type="button"
            className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-sm font-semibold"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="mt-5 rounded-2xl border border-[var(--paper-border)] p-4">
          {crisis ? <RiskNotice risk={risk} /> : <SupportNotice risk={risk} />}
        </div>
      </motion.div>
    </motion.div>
  );
}

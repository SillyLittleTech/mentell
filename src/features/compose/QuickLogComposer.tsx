import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { LimitedFieldLabel, LimitedInput } from "../../components/LimitedField";
import { MaterialIcon } from "../../components/MaterialIcon";
import {
  SentimentPills,
  type SentimentValue,
} from "../../components/SentimentPills";
import { Throbber } from "../../components/Throbber";
import { dateKeyForLocalDay } from "../../shared/dates";
import {
  assessLocalRisk,
  assessRisk,
  type RiskAssessment,
} from "../safety/riskAssessment";
import {
  RiskResultModal,
  shouldShowPostSubmitRiskModal,
} from "../safety/RiskResultModal";
import { applyRiskAssessmentToEntry } from "../entries/entryService";
import type { EntryEmotion } from "../../db/schema";
import { QUICK_LOG_NOTE_MAX } from "../../shared/limits/entryLimits";
import { ignorePromise } from "../../shared/promise/ignorePromise";

/** Normalized payload for a quick-log entry before persistence. */
export type QuickLogDraft = {
  dateKey: string;
  sentiment: SentimentValue;
  emotion: EntryEmotion;
  emotionNote: string;
  situation: string;
  details: string;
  behavioursNoted: string;
  reoccurringTheme: string;
  quickLogNote: string;
  flaggedTerms: string[];
  warningLevel: "none" | "warn";
  riskScore: number;
  interventionScore: number;
  riskLevel: import("../../db/schema").RiskLevel;
};

/** Public type `QuickLogComposerProps` for Mentell 2.x. */
export type QuickLogComposerProps = {
  disabled?: boolean;
  onSubmit: (draft: QuickLogDraft) => Promise<string | void>;
};

function quickLogRiskInput(
  dateKey: string,
  sentiment: SentimentValue,
  note: string,
) {
  const trimmed = note.trim();
  return {
    dateKey,
    sentiment,
    emotion: "other" as const,
    emotionNote: "",
    situation: trimmed ? "Quick log" : "",
    details: trimmed,
  };
}

/** Short-form journal composer (sentiment + optional note). */
export function QuickLogComposer(props: Readonly<QuickLogComposerProps>) {
  const { disabled, onSubmit } = props;
  const [sentiment, setSentiment] = useState<SentimentValue>("=");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [deferredRisk, setDeferredRisk] = useState<RiskAssessment | null>(null);

  async function runDeferredRiskReview(
    entryId: string,
    riskInput: ReturnType<typeof quickLogRiskInput>,
  ) {
    const fullRisk = await assessRisk(riskInput);
    await applyRiskAssessmentToEntry(entryId, fullRisk);
    if (shouldShowPostSubmitRiskModal(fullRisk)) {
      setDeferredRisk(fullRisk);
    }
  }

  /** Documents `handleSubmit` in this module. */
  async function handleSubmit() {
    if (disabled || busy) return;
    setBusy(true);
    try {
      const dateKey = dateKeyForLocalDay(new Date());
      const trimmed = note.trim();
      const riskInput = quickLogRiskInput(dateKey, sentiment, note);
      const localRisk = await assessLocalRisk(riskInput);
      const entryId = await onSubmit({
        dateKey,
        sentiment,
        emotion: "other",
        emotionNote: "",
        situation: "Quick log",
        details: "",
        behavioursNoted: "",
        reoccurringTheme: "",
        quickLogNote: trimmed,
        flaggedTerms: localRisk.flaggedTerms,
        warningLevel: localRisk.warningLevel,
        riskScore: localRisk.riskScore,
        interventionScore: localRisk.interventionScore,
        riskLevel: localRisk.riskLevel,
      });
      setNote("");
      if (trimmed && entryId) {
        ignorePromise(runDeferredRiskReview(entryId, riskInput));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section
        className={`paper rounded-3xl p-6 ${disabled ? "pointer-events-none opacity-50" : ""}`}
        aria-disabled={disabled || undefined}
      >
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="font-paper text-2xl">Quick log</div>
            <div className="ink-muted mt-1 text-sm">
              Sentiment only — optional short note ({QUICK_LOG_NOTE_MAX} chars
              max).
            </div>
          </div>
          <MaterialIcon
            name="schedule"
            accent={false}
            className="opacity-70"
            size={28}
          />
        </header>
        <div className="mt-6 space-y-4">
          <SentimentPills
            value={sentiment}
            onChange={disabled ? () => {} : setSentiment}
          />
          <div>
            <LimitedFieldLabel
              label="Optional note"
              overLimit={note.length > QUICK_LOG_NOTE_MAX}
            />
            <LimitedInput
              id="quick-log-note"
              value={note}
              maxChars={QUICK_LOG_NOTE_MAX}
              disabled={disabled}
              onChange={(e) => setNote(e.target.value)}
              placeholder="A few words (optional)"
              className="mt-1 border-[var(--paper-border)]"
            />
          </div>
          <button
            type="button"
            className="btn-primary focus-ring inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold"
            disabled={disabled || busy}
            onClick={() => ignorePromise(handleSubmit())}
          >
            <MaterialIcon
              name="schedule"
              accent={false}
              size={20}
              className="text-[rgba(0,0,0,0.92)]"
            />
            {busy ? <Throbber label="Saving" /> : "Save quick log"}
          </button>
        </div>
      </section>
      <AnimatePresence>
        {deferredRisk ? (
          <RiskResultModal
            risk={deferredRisk}
            onClose={() => setDeferredRisk(null)}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}

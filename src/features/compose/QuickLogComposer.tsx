import { useState } from "react";
import { LimitedFieldLabel, LimitedInput } from "../../components/LimitedField";
import { MaterialIcon } from "../../components/MaterialIcon";
import {
  SentimentPills,
  type SentimentValue,
} from "../../components/SentimentPills";
import { Throbber } from "../../components/Throbber";
import { dateKeyForLocalDay } from "../../shared/dates";
import { assessRisk, type RiskAssessment } from "../safety/riskAssessment";
import type { EntryEmotion } from "../../db/schema";
import { QUICK_LOG_NOTE_MAX } from "../../shared/limits/entryLimits";

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

export type QuickLogComposerProps = {
  disabled?: boolean;
  onSubmit: (draft: QuickLogDraft) => Promise<void>;
};

export function QuickLogComposer({
  disabled,
  onSubmit,
}: QuickLogComposerProps) {
  const [sentiment, setSentiment] = useState<SentimentValue>("=");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    if (disabled || busy) return;
    setBusy(true);
    try {
      const dateKey = dateKeyForLocalDay(new Date());
      const riskInput = {
        dateKey,
        sentiment,
        emotion: "other" as const,
        emotionNote: "",
        situation: "Quick log",
        details: note.trim() ? note.trim() : "Quick log (sentiment only)",
      };
      const risk: RiskAssessment = await assessRisk(riskInput);
      await onSubmit({
        dateKey,
        sentiment,
        emotion: "other",
        emotionNote: "",
        situation: "Quick log",
        details: "",
        behavioursNoted: "",
        reoccurringTheme: "",
        quickLogNote: note.trim(),
        flaggedTerms: risk.flaggedTerms,
        warningLevel: risk.warningLevel,
        riskScore: risk.riskScore,
        interventionScore: risk.interventionScore,
        riskLevel: risk.riskLevel,
      });
      setNote("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="paper rounded-3xl p-6">
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
          onChange={(v) => (disabled ? {} : setSentiment(v))}
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
          onClick={() => void handleSubmit()}
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
  );
}

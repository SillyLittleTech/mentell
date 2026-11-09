import {
  getDb,
  type EntryEmotion,
  type EntryKindJournal,
  type EntryKindQuickLog,
  type EntryRow,
  type EntrySentiment,
  type RiskLevel,
  type WarningLevel,
} from "../../db/schema";
import type { RiskAssessment } from "../safety/riskAssessment";
import { makeId } from "../../shared/id";
import { assertEntryFieldLimits } from "../../shared/limits/entryLimits";
import { notifyLocalDataChanged } from "../../shared/sync/localDataEvents";

/** Public type `EntryDraft` for Mentell 2.x. */
export type EntryDraft = {
  dateKey: string;
  entryType?: EntryKindJournal | EntryKindQuickLog;
  sentiment: EntrySentiment;
  emotion: EntryEmotion;
  emotionNote: string;
  situation: string;
  details: string;
  behavioursNoted: string;
  reoccurringTheme: string;
  quickLogNote?: string;
  flaggedTerms: string[];
  warningLevel: WarningLevel;
  riskScore: number;
  interventionScore: number;
  riskLevel: RiskLevel;
  scoreDelta: number;
  /** @deprecated Legacy 1.x */
  streakAtSubmit: number;
  hbcmAtSubmit: number;
};

/** Async API: `upsertEntryFromDraft`. */
export async function upsertEntryFromDraft(draft: EntryDraft) {
  assertEntryFieldLimits(draft);

  const now = Date.now();
  const kind = draft.entryType ?? "entry";

  const row: EntryRow = {
    id: makeId("entry"),
    createdAt: now,
    updatedAt: now,
    dateKey: draft.dateKey,
    entryType: kind,
    sentiment: draft.sentiment,
    emotion: draft.emotion,
    emotionNote: draft.emotionNote,
    situation: draft.situation,
    details: draft.details,
    behavioursNoted: draft.behavioursNoted,
    reoccurringTheme: draft.reoccurringTheme,
    quickLogNote:
      kind === "quick_log" ? (draft.quickLogNote ?? "").trim() : undefined,
    flaggedTerms: draft.flaggedTerms,
    warningLevel: draft.warningLevel,
    riskScore: draft.riskScore,
    interventionScore: draft.interventionScore,
    riskLevel: draft.riskLevel,
    scoreDelta: draft.scoreDelta,
    streakAtSubmit: draft.streakAtSubmit,
    hbcmAtSubmit: draft.hbcmAtSubmit,
  };

  await getDb().entries.put(row);
  notifyLocalDataChanged();

  return row;
}

/** Patch risk fields after a deferred quick-log safety review. */
export async function applyRiskAssessmentToEntry(
  entryId: string,
  risk: RiskAssessment,
) {
  const row = await getDb().entries.get(entryId);
  if (!row) return;
  await getDb().entries.put({
    ...row,
    updatedAt: Date.now(),
    flaggedTerms: risk.flaggedTerms,
    warningLevel: risk.warningLevel,
    riskScore: risk.riskScore,
    interventionScore: risk.interventionScore,
    riskLevel: risk.riskLevel,
  });
  notifyLocalDataChanged();
}

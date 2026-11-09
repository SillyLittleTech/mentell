/** Max characters for journal compose fields (new writes). */
export const ENTRY_DETAILS_MAX = 10_000;
/** Max characters for the situation field on new entries. */
export const ENTRY_SITUATION_MAX = 150;
/** Constant `ENTRY_EMOTION_NOTE_MAX` used by the app. */
export const ENTRY_EMOTION_NOTE_MAX = 15;
/** Constant `ENTRY_BEHAVIOURS_NOTED_MAX` used by the app. */
export const ENTRY_BEHAVIOURS_NOTED_MAX = 500;
/** Constant `ENTRY_REOCCURRING_THEME_MAX` used by the app. */
export const ENTRY_REOCCURRING_THEME_MAX = 500;
/** Constant `QUICK_LOG_NOTE_MAX` used by the app. */
export const QUICK_LOG_NOTE_MAX = 200;

/** `isOverLimit` — see module for behavior. */
export function isOverLimit(value: string, max: number) {
  return value.length > max;
}

/** `draftFieldsOverLimit` — see module for behavior. */
export function draftFieldsOverLimit(draft: {
  situation: string;
  details: string;
  emotionNote?: string;
  behavioursNoted?: string;
  reoccurringTheme?: string;
}) {
  return (
    isOverLimit(draft.situation, ENTRY_SITUATION_MAX) ||
    isOverLimit(draft.details, ENTRY_DETAILS_MAX) ||
    isOverLimit(draft.emotionNote ?? "", ENTRY_EMOTION_NOTE_MAX) ||
    isOverLimit(draft.behavioursNoted ?? "", ENTRY_BEHAVIOURS_NOTED_MAX) ||
    isOverLimit(draft.reoccurringTheme ?? "", ENTRY_REOCCURRING_THEME_MAX)
  );
}

/** `assertEntryFieldLimits` — see module for behavior. */
export function assertEntryFieldLimits(draft: {
  situation: string;
  details: string;
  emotionNote?: string;
  behavioursNoted?: string;
  reoccurringTheme?: string;
  quickLogNote?: string;
}) {
  if (draft.situation.length > ENTRY_SITUATION_MAX) {
    throw new Error(
      `Situation must be at most ${ENTRY_SITUATION_MAX} characters.`,
    );
  }
  if (draft.details.length > ENTRY_DETAILS_MAX) {
    throw new Error(`Details must be at most ${ENTRY_DETAILS_MAX} characters.`);
  }
  if ((draft.emotionNote ?? "").length > ENTRY_EMOTION_NOTE_MAX) {
    throw new Error(
      `Emotion note must be at most ${ENTRY_EMOTION_NOTE_MAX} characters.`,
    );
  }
  if ((draft.behavioursNoted ?? "").length > ENTRY_BEHAVIOURS_NOTED_MAX) {
    throw new Error(
      `Behaviours noted must be at most ${ENTRY_BEHAVIOURS_NOTED_MAX} characters.`,
    );
  }
  if ((draft.reoccurringTheme ?? "").length > ENTRY_REOCCURRING_THEME_MAX) {
    throw new Error(
      `Reoccurring theme must be at most ${ENTRY_REOCCURRING_THEME_MAX} characters.`,
    );
  }
  if ((draft.quickLogNote ?? "").length > QUICK_LOG_NOTE_MAX) {
    throw new Error(
      `Quick log note must be at most ${QUICK_LOG_NOTE_MAX} characters.`,
    );
  }
}

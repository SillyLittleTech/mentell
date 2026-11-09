import type { FeelingPoint } from "./feelingsOverTimeData";
import { labelForEmotion } from "./projectorEntryStyles";

/** Human label for chart day class (missed / no data / logged days). */
export function feelingClassLabel(className: FeelingPoint["class"]): string {
  switch (className) {
    case "positive":
      return "Positive day";
    case "negative":
      return "Difficult day";
    case "neutral":
      return "Mixed or steady day";
    case "missed":
      return "Missed day";
    default:
      return "No entry";
  }
}

/** Human label for entry sentiment mark. */
export function sentimentTooltipLabel(
  sentiment: FeelingPoint["sentiment"],
): string | null {
  if (!sentiment) return null;
  if (sentiment === "+") return "Positive";
  if (sentiment === "-") return "Difficult";
  return "Neutral / mixed";
}

/** Emotion line for chart tooltip (quick log may omit). */
export function emotionTooltipLine(p: FeelingPoint): string | null {
  if (p.entryType === "quick_log") {
    return p.note ? `Quick log: ${p.note}` : "Quick log";
  }
  if (p.emotionNote?.trim()) return p.emotionNote.trim();
  if (p.emotion) return labelForEmotion(p.emotion);
  return null;
}

/**
 * Shared feelings-over-time / weekly bar semantics.
 * @see docs/SCORING_SEMANTICS.md
 */

import type { EntryRow } from "../../db/schema";

/** Public type `FeelingDayClass` for Mentell 2.x. */
export type FeelingDayClass =
  "positive" | "neutral" | "negative" | "missed" | "no_data";

const SENTIMENT_RANK: Record<string, number> = { "-": 2, "=": 1, "+": 0 };

type EntrySentimentMark = "+" | "-" | "=";

/** Picks the stronger of two entry sentiments for multi-entry days. */
export function strongestSentiment(a: string, b: string): EntrySentimentMark {
  const ra = SENTIMENT_RANK[a] ?? 0;
  const rb = SENTIMENT_RANK[b] ?? 0;
  if (rb > ra) return b as EntrySentimentMark;
  return a as EntrySentimentMark;
}

/** Maps journal sentiment to a positive / neutral / negative day class. */
export function classForSentiment(
  s: EntrySentimentMark,
): Exclude<FeelingDayClass, "missed" | "no_data"> {
  if (s === "+") return "positive";
  if (s === "-") return "negative";
  return "neutral";
}

/** Classifies a calendar day with or without entries (missed / no_data). */
export function pickDayClass(
  hasEntry: boolean,
  sentiment: "+" | "-" | "=",
  dayKey: string,
  todayKey: string,
  firstEntryKey: string | null,
): FeelingDayClass {
  if (hasEntry) return classForSentiment(sentiment);
  if (!firstEntryKey) return "no_data";
  if (dayKey < firstEntryKey) return "no_data";
  if (dayKey > todayKey) return "no_data";
  if (dayKey < todayKey) return "missed";
  return "no_data";
}

/** Chooses the representative entry row for a single calendar day. */
export function aggregateEntriesForDay(entries: EntryRow[]): EntryRow | null {
  if (!entries.length) return null;
  let pick = entries[0];
  for (const e of entries.slice(1)) {
    if (strongestSentiment(pick.sentiment, e.sentiment) === e.sentiment)
      pick = e;
  }
  return pick;
}

/**
 * @file Loads per-day feeling classes from Dexie for the Projector chart.
 */
import {
  addDays,
  endOfMonth,
  endOfYear,
  format,
  min as minDate,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { getDb, type EntryRow } from "../../db/schema";
import { dateKeyForLocalDay, stripDateKey } from "../../shared/dates";
import {
  aggregateEntriesForDay,
  pickDayClass,
  type FeelingDayClass,
} from "./feelingsSemantics";

/** Time window for the projector feelings-over-time chart. */
export type FeelingsRange = "week" | "month" | "year" | "all";

/** One day in the feelings-over-time series shown on the Projector. */
export type FeelingPoint = {
  dateKey: string;
  label: string;
  class: FeelingDayClass;
  createdAt: number;
  note?: string;
  entryId?: string;
  sentiment?: EntryRow["sentiment"];
  emotion?: EntryRow["emotion"];
  emotionNote?: string;
  situation?: string;
  entryType?: EntryRow["entryType"];
};

/** Documents `toKey` in this module. */
function toKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

/** Documents `loadEntriesInRange` in this module. */
async function loadEntriesInRange(
  startKey: string,
  endKey: string,
): Promise<EntryRow[]> {
  const a = await getDb()
    .entries.where("dateKey")
    .between(startKey, endKey, true, true)
    .toArray();
  const b = await getDb()
    .entries.where("dateKey")
    .between("~" + startKey, "~" + endKey, true, true)
    .toArray();
  return [...a, ...b];
}

/**
 * Loads per-day feeling classes from Dexie for the selected calendar range.
 * Used by the weekly projector chart (week / month / year / all).
 */
/** Async API: `getFeelingsOverTimeSeries`. */
export async function getFeelingsOverTimeSeries(
  range: FeelingsRange,
  anchorDate: Date = new Date(),
): Promise<{ points: FeelingPoint[]; todayKey: string }> {
  const todayKey = dateKeyForLocalDay(anchorDate);
  const anchor = parseISO(stripDateKey(todayKey));

  let start: Date;
  let end: Date;
  if (range === "week") {
    start = startOfWeek(anchor, { weekStartsOn: 1 });
    end = addDays(start, 6);
  } else if (range === "month") {
    start = startOfMonth(anchor);
    end = minDate([endOfMonth(anchor), anchor]);
  } else if (range === "year") {
    start = startOfYear(anchor);
    end = minDate([endOfYear(anchor), anchor]);
  } else {
    const first = await getDb().entries.orderBy("dateKey").first();
    if (!first) return { points: [], todayKey };
    const fk = stripDateKey(first.dateKey);
    start = parseISO(fk);
    end = anchor;
  }

  const startKey = toKey(start);
  const endKey = toKey(end);
  const all = await loadEntriesInRange(startKey, endKey);

  const byDay = new Map<string, EntryRow[]>();
  for (const row of all) {
    const dk = stripDateKey(row.dateKey);
    const list = byDay.get(dk) ?? [];
    list.push(row);
    byDay.set(dk, list);
  }

  const firstRow = await getDb().entries.orderBy("dateKey").first();
  const firstEntryKey = firstRow ? stripDateKey(firstRow.dateKey) : null;

  const points: FeelingPoint[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const dateKey = toKey(d);
    const list = byDay.get(dateKey) ?? [];
    const agg = aggregateEntriesForDay(list);
    const hasEntry = Boolean(agg);
    const sentiment = (agg?.sentiment ?? "=") as "+" | "-" | "=";
    const cls = pickDayClass(
      hasEntry,
      sentiment,
      dateKey,
      todayKey,
      firstEntryKey,
    );
    points.push({
      dateKey,
      label: format(d, "MMM d"),
      class: cls,
      createdAt: agg?.createdAt ?? 0,
      note:
        agg?.entryType === "quick_log"
          ? agg.quickLogNote?.trim() || undefined
          : undefined,
      entryId: agg?.id,
      sentiment: agg?.sentiment,
      emotion: agg?.emotion,
      emotionNote: agg?.emotionNote?.trim() || undefined,
      situation: agg?.situation?.trim() || undefined,
      entryType: agg?.entryType,
    });
  }

  return { points, todayKey };
}

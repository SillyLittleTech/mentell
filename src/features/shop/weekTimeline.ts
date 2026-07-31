import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { getDb } from "../../db/schema";
import { dateKeyForLocalDay, stripDateKey } from "../../shared/dates";

export type WeekDayStatus = "completed" | "missed" | "noData";

export type WeekTimelineDay = {
  dateKey: string;
  label: string;
  status: WeekDayStatus;
};

function toDateKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export async function getWeekTimelineDays(
  anchorDateKey: string = dateKeyForLocalDay(new Date()),
): Promise<WeekTimelineDay[]> {
  const anchor = parseISO(stripDateKey(anchorDateKey));
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const todayKey = dateKeyForLocalDay(new Date());

  const weekEndKey = toDateKey(addDays(weekStart, 6));
  const entriesNorm = await getDb()
    .entries.where("dateKey")
    .between(toDateKey(weekStart), weekEndKey, true, true)
    .toArray();
  const entriesBulk = await getDb()
    .entries.where("dateKey")
    .between("~" + toDateKey(weekStart), "~" + weekEndKey, true, true)
    .toArray();
  const entries = [...entriesNorm, ...entriesBulk];

  const completedKeys = new Set(entries.map((e) => e.dateKey));

  const firstRow = await getDb().entries.orderBy("dateKey").first();
  const firstEntryDate = firstRow?.dateKey ?? null;

  const days: WeekTimelineDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    const dateKey = toDateKey(d);
    const label = format(d, "EEE");

    let status: WeekDayStatus = "noData";
    if (completedKeys.has(dateKey) || completedKeys.has("~" + dateKey)) {
      status = "completed";
    } else if (!firstEntryDate) {
      // No logs yet — past days are not "missed"
    } else if (dateKey < firstEntryDate) {
      status = "noData";
    } else if (dateKey > todayKey) {
      status = "noData";
    } else if (dateKey < todayKey) {
      status = "missed";
    } else {
      status = "noData";
    }

    days.push({ dateKey, label, status });
  }

  return days;
}

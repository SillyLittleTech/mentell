import { subDays, format } from "date-fns";
import { getDb } from "../../db/schema";
import { getScoreSnapshot } from "../score/scoreService";
import type {
  ShareDashboardPayload,
  ShareEntryPreview,
  SharePermissions,
} from "./shareTypes";

export async function buildSharePayload(
  permissions: SharePermissions,
): Promise<ShareDashboardPayload> {
  const cutoff = format(subDays(new Date(), permissions.maxDays), "yyyy-MM-dd");

  const entriesNorm = await getDb()
    .entries.where("dateKey")
    .aboveOrEqual(cutoff)
    .toArray();
  const filteredNorm = entriesNorm.filter((e) => e.dateKey < "~");
  const entriesBulk = await getDb()
    .entries.where("dateKey")
    .aboveOrEqual("~" + cutoff)
    .toArray();

  const inWindow = [...filteredNorm, ...entriesBulk].sort(
    (a, b) => b.createdAt - a.createdAt,
  );

  let positives = 0;
  let negatives = 0;
  let mixed = 0;
  let warnings = 0;
  for (const e of inWindow) {
    if (e.sentiment === "+") positives++;
    else if (e.sentiment === "-") negatives++;
    else mixed++;
    if (e.warningLevel === "warn") warnings++;
  }

  const score = getScoreSnapshot();
  const entries: ShareEntryPreview[] = permissions.showRecentEntries
    ? inWindow.map((e) => {
        const row: ShareEntryPreview = {
          id: e.id,
          dateKey: e.dateKey,
          createdAt: e.createdAt,
          sentiment: e.sentiment,
        };
        if (permissions.showSituation) row.situation = e.situation;
        if (permissions.showEmotion) row.emotion = e.emotion;
        if (permissions.showEmotionNote) row.emotionNote = e.emotionNote;
        if (permissions.showDetails) {
          row.details = e.details;
          row.behavioursNoted = e.behavioursNoted;
          row.reoccurringTheme = e.reoccurringTheme;
        }
        if (permissions.showWarningsCount) row.warningLevel = e.warningLevel;
        return row;
      })
    : [];

  return {
    generatedAt: Date.now(),
    entryCount: inWindow.length,
    positives,
    negatives,
    mixed,
    warnings,
    entries,
    ...(permissions.showStreak ? { streak: score.streak } : {}),
    ...(permissions.showScore ? { score: score.total } : {}),
  };
}

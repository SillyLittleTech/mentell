import { describe, it, expect, beforeEach } from "vitest";
import { getDb } from "../../db/schema";
import { loadAllEntriesForSearch } from "./projectorSearch";
import "fake-indexeddb/auto";

describe("projectorSearch indexing", () => {
  beforeEach(async () => {
    await getDb().entries.clear();
  });

  it("excludes quick_log rows from AI search payload", async () => {
    const now = Date.now();
    await getDb().entries.bulkPut([
      {
        id: "e1",
        createdAt: now,
        updatedAt: now,
        dateKey: "2026-06-01",
        entryType: "entry",
        sentiment: "+",
        emotion: "calm",
        emotionNote: "",
        situation: "Full entry",
        details: "Details",
        behavioursNoted: "",
        reoccurringTheme: "",
        flaggedTerms: [],
        warningLevel: "none",
        riskScore: 0,
        interventionScore: 0,
        riskLevel: "none",
        scoreDelta: 0,
        streakAtSubmit: 0,
      },
      {
        id: "q1",
        createdAt: now + 1,
        updatedAt: now + 1,
        dateKey: "2026-06-02",
        entryType: "quick_log",
        sentiment: "-",
        emotion: "sad",
        emotionNote: "",
        situation: "",
        details: "",
        behavioursNoted: "",
        reoccurringTheme: "",
        quickLogNote: "tired",
        flaggedTerms: [],
        warningLevel: "none",
        riskScore: 0,
        interventionScore: 0,
        riskLevel: "none",
        scoreDelta: 0,
        streakAtSubmit: 0,
      },
    ]);

    const rows = await loadAllEntriesForSearch();
    expect(rows.map((r) => r.id).sort()).toEqual(["e1"]);
  });
});

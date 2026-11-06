import "fake-indexeddb/auto";
import { performance } from "perf_hooks";
import { getDb } from "../../src/db/schema";
import { buildSharePayload } from "../../src/features/share/sharePayloadBuilder";
import { format, subDays } from "date-fns";

// Mock localStorage
global.localStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
  clear: () => undefined,
  length: 0,
  key: () => null,
} as unknown as Storage;

async function runBenchmark() {
  console.log("Setting up in-memory IndexedDB...");

  const actualDb = getDb();

  console.log("Populating DB with mock entries...");
  const entries = [];
  const TOTAL_ENTRIES = 10000;
  const now = new Date();

  for (let entryIndex = 0; entryIndex < TOTAL_ENTRIES; entryIndex++) {
    const entryDate = subDays(now, entryIndex % 1000);
    const isBulk = entryIndex % 10 === 0;
    const dateKey = (isBulk ? "~" : "") + format(entryDate, "yyyy-MM-dd");

    entries.push({
      id: `entry-${entryIndex}`,
      dateKey,
      createdAt: entryDate.getTime(),
      updatedAt: entryDate.getTime(),
      sentiment: entryIndex % 3 === 0 ? "+" : entryIndex % 3 === 1 ? "-" : "neutral",
      warningLevel: entryIndex % 100 === 0 ? "warn" : "none",
      riskLevel: entryIndex % 100 === 0 ? "elevated" : "none",
      emotion: "happy",
      emotionNote: "test",
      situation: "test",
      details: "test",
      behavioursNoted: "test",
      reoccurringTheme: "test",
    });
  }

  await actualDb.entries.bulkAdd(entries);

  console.log(`DB populated with ${TOTAL_ENTRIES} entries.`);

  const permissions = {
    maxDays: 30, // Window of 30 days
    showRecentEntries: true,
    showSituation: true,
    showEmotion: true,
    showEmotionNote: true,
    showDetails: true,
    showWarningsCount: true,
    showStreak: true,
    showScore: true,
  };

  // Warmup
  await buildSharePayload(permissions);

  const iterations = 100;
  console.log(`Running benchmark (${iterations} iterations)...`);

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    await buildSharePayload(permissions);
  }
  const end = performance.now();

  const totalTime = end - start;
  const avgTime = totalTime / iterations;

  console.log(`Total time: ${totalTime.toFixed(2)} ms`);
  console.log(`Average time per call: ${avgTime.toFixed(2)} ms`);

  // Write result to file for GH action comparison
  const fs = await import("fs");
  fs.writeFileSync(
    "benchmark_result.json",
    JSON.stringify({ avgTime, totalTime }),
  );

  process.exit(0);
}

runBenchmark().catch(console.error);

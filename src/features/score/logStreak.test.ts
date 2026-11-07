import { describe, expect, it } from "vitest";
import { nextLogStreakOnFirstDailyLog } from "./logStreak";

describe("nextLogStreakOnFirstDailyLog", () => {
  it("starts at 1 on first log", () => {
    expect(nextLogStreakOnFirstDailyLog(0, null, "2026-03-01")).toBe(1);
  });

  it("increments on consecutive days", () => {
    expect(nextLogStreakOnFirstDailyLog(3, "2026-03-01", "2026-03-02")).toBe(
      4,
    );
  });

  it("resets after a gap", () => {
    expect(nextLogStreakOnFirstDailyLog(8, "2026-03-01", "2026-03-05")).toBe(1);
  });
});

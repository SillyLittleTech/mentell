import { describe, it, expect } from "vitest";
import {
  EMA_ALPHA,
  normalizedRiskInput,
  sustainedElevatedHeat,
  updateEmaRmaState,
  type EmaRmaHeatState,
} from "./emaRmaHeat";

describe("emaRmaHeat", () => {
  it("uses documented alpha for N=5", () => {
    expect(EMA_ALPHA).toBeCloseTo(2 / 6, 5);
  });

  it("normalizedRiskInput maps crisis and sentiment into [-1,1]", () => {
    const low = normalizedRiskInput({
      riskScore: 0.2,
      riskLevel: "low",
      warningLevel: "none",
      sentiment: "=",
    });
    expect(low).toBeGreaterThanOrEqual(-1);
    expect(low).toBeLessThanOrEqual(1);

    const hi = normalizedRiskInput({
      riskScore: 0.95,
      riskLevel: "crisis",
      warningLevel: "warn",
      sentiment: "-",
    });
    expect(hi).toBeGreaterThan(0.7);
  });

  it("does not escalate sustained heat from a single isolated spike", () => {
    const spike = normalizedRiskInput({
      riskScore: 0.9,
      riskLevel: "elevated",
      warningLevel: "none",
      sentiment: "-",
    });
    let state = updateEmaRmaState(null, spike, 1);
    for (let i = 0; i < 3; i++) {
      state = updateEmaRmaState(
        state,
        normalizedRiskInput({
          riskScore: 0.1,
          riskLevel: "none",
          warningLevel: "none",
          sentiment: "+",
        }),
        i + 2,
      );
    }
    expect(sustainedElevatedHeat(state, 0.42)).toBe(false);
  });

  it("detects compounding moderate risk after several assessments", () => {
    const moderate = normalizedRiskInput({
      riskScore: 0.65,
      riskLevel: "elevated",
      warningLevel: "none",
      sentiment: "-",
    });
    let state: EmaRmaHeatState | null = null;
    const now = 1;
    for (let i = 0; i < 8; i++) {
      state = updateEmaRmaState(state, moderate, now + i);
    }
    expect(state).not.toBeNull();
    expect(sustainedElevatedHeat(state, 0.42)).toBe(true);
  });
});

/**
 * EMA/RMA heat — normalized [-1, 1] risk compounding for sustained distress.
 * @see docs/SCORING_SEMANTICS.md
 */

export const EMA_RMA_N = 5;
export const EMA_ALPHA = 2 / (EMA_RMA_N + 1);

export type EmaRmaHeatState = {
  ema: number;
  rmaWindow: number[];
  lastUpdatedAt: number;
};

const MAX_WINDOW = EMA_RMA_N;

export function clampNeg1To1(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(-1, n));
}

/** Map crisis-style signals to normalized heat input (higher = more concern). */
export function normalizedRiskInput(params: {
  riskScore: number;
  riskLevel: "none" | "low" | "elevated" | "crisis";
  warningLevel: "none" | "warn";
  sentiment: "+" | "-" | "=";
}): number {
  let v = params.riskScore * 2 - 1;
  if (params.riskLevel === "crisis") v = Math.max(v, 0.85);
  else if (params.riskLevel === "elevated") v = Math.max(v, 0.45);
  else if (params.riskLevel === "low") v = Math.max(v, 0.12);
  if (params.warningLevel === "warn") v += 0.12;
  if (params.sentiment === "-") v += 0.08;
  if (params.sentiment === "+") v -= 0.05;
  return clampNeg1To1(v);
}

export function pushRmaWindow(prev: number[], value: number): number[] {
  const next = [...prev, value];
  if (next.length > MAX_WINDOW) next.splice(0, next.length - MAX_WINDOW);
  return next;
}

export function rmaFromWindow(window: number[]): number {
  if (!window.length) return 0;
  const sum = window.reduce((a, b) => a + b, 0);
  return clampNeg1To1(sum / window.length);
}

export function nextEma(
  prevEma: number,
  score: number,
  alpha = EMA_ALPHA,
): number {
  return clampNeg1To1(score * alpha + prevEma * (1 - alpha));
}

export function updateEmaRmaState(
  state: EmaRmaHeatState | null,
  score: number,
  now: number,
): EmaRmaHeatState {
  const prev = state?.ema ?? 0;
  const window = pushRmaWindow(state?.rmaWindow ?? [], score);
  return {
    ema: state ? nextEma(prev, score) : clampNeg1To1(score),
    rmaWindow: window,
    lastUpdatedAt: now,
  };
}

/** True when compounding moderate risk should surface (no single-spike reliance). */
export function sustainedElevatedHeat(
  state: EmaRmaHeatState | null,
  threshold = 0.42,
): boolean {
  if (!state) return false;
  if (state.rmaWindow.length < 3) return false;
  return (
    state.ema >= threshold && rmaFromWindow(state.rmaWindow) >= threshold - 0.05
  );
}

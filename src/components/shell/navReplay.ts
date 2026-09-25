/** Increment replay counter for a nav tab click (shared by mobile + desktop nav). */
export function bumpNavReplayTokens(prev: Record<string, number>, to: string): Record<string, number> {
  return { ...prev, [to]: (prev[to] ?? 0) + 1 }
}

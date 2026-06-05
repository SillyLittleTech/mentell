export const SCORE_CHANGED_EVENT = 'mentell:score-changed'

export function notifyScoreChanged() {
  window.dispatchEvent(new CustomEvent(SCORE_CHANGED_EVENT))
}

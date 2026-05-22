export const LOCAL_DATA_CHANGED_EVENT = 'mentell:local-data-changed'

export function notifyLocalDataChanged() {
  window.dispatchEvent(new CustomEvent(LOCAL_DATA_CHANGED_EVENT))
}

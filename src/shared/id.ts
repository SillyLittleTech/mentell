export function makeId(prefix: string) {
  // No crypto dependency; good enough for local-only keys.
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}


import { Timestamp } from "firebase/firestore";

export function stripUndefined<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Timestamp) return value;
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as T;
  }
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (val === undefined) continue;
    out[key] = stripUndefined(val);
  }
  return out as T;
}

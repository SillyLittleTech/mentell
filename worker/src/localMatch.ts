import type { EntrySnapshot } from "./entryMerge";
import {
  localMatchEntries as sharedMatch,
  mergeEntrySnapshots as sharedMerge,
} from "../../src/lib/localMatch";

export function localMatchEntries(
  entries: EntrySnapshot[],
  query: string,
): EntrySnapshot[] {
  return sharedMatch(entries as any, query) as any;
}

export function mergeEntrySnapshots(
  primary: EntrySnapshot[],
  secondary: EntrySnapshot[],
  limit = 20,
): EntrySnapshot[] {
  return sharedMerge(primary as any, secondary as any, limit) as any;
}

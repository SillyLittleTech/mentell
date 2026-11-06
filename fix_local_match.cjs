const fs = require('fs');

const sharedMatchPath = 'src/lib/localMatch.ts';
const workerMatchPath = 'worker/src/localMatch.ts';
const projectorSearchPath = 'src/features/compilation/projectorSearch.ts';

// 1. Shared logic
let sharedContent = `export type EntrySnapshot = {
  id: string;
  createdAt?: number;
  updatedAt?: number;
  dateKey: string;
  sentiment: string;
  emotion?: string | null;
  emotionNote?: string | null;
  situation?: string | null;
  details?: string | null;
  behavioursNoted?: string | null;
  reoccurringTheme?: string | null;
};

import { STOP_WORDS } from './stopWords';

/** Match journal entries locally (keyword + sentiment cues). Used to enrich AI Search. */
export function localMatchEntries(entries: EntrySnapshot[], query: string): EntrySnapshot[] {
  const q = query.trim().toLowerCase();
  if (!q || entries.length === 0) return [];

  const wantsNeg = /\\b(negative|negatives|bad|sad|down)\\b/.test(q);
  const wantsPos = /\\b(positive|positives|good|happy|upbeat)\\b/.test(q);
  const wantsMixed = /\\b(mixed|neutral|=)\\b/.test(q);

  if (wantsNeg || wantsPos || wantsMixed) {
    return entries
      .filter((e) => {
        if (wantsNeg && e.sentiment === "-") return true;
        if (wantsPos && e.sentiment === "+") return true;
        if (wantsMixed && e.sentiment === "=") return true;
        return false;
      })
      .slice(0, 20);
  }

  const terms = q
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
  if (terms.length === 0) return [];

  return entries
    .filter((e) => {
      const hay =
        \`\${e.situation} \${e.details} \${e.behavioursNoted ?? ""} \${e.reoccurringTheme ?? ""} \${e.emotionNote ?? ""} \${e.emotion ?? ""} \${e.dateKey}\`.toLowerCase();
      return terms.some((term) => {
        try {
          return new RegExp(\`\\\\b\${term}\\\\b\`).test(hay);
        } catch {
          return hay.includes(term);
        }
      });
    })
    .slice(0, 20);
}

export function mergeEntrySnapshots(
  primary: EntrySnapshot[],
  secondary: EntrySnapshot[],
  limit = 20,
): EntrySnapshot[] {
  const seen = new Set<string>();
  const out: EntrySnapshot[] = [];
  for (const e of [...primary, ...secondary]) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}
`;

fs.writeFileSync(sharedMatchPath, sharedContent);

// 2. Write the worker file
let workerContent = `import type { EntrySnapshot } from './entryMerge';
import { localMatchEntries as sharedMatch, mergeEntrySnapshots as sharedMerge } from '../../src/lib/localMatch';

export function localMatchEntries(entries: EntrySnapshot[], query: string): EntrySnapshot[] {
  return sharedMatch(entries as any, query) as any;
}

export function mergeEntrySnapshots(primary: EntrySnapshot[], secondary: EntrySnapshot[], limit = 20): EntrySnapshot[] {
  return sharedMerge(primary as any, secondary as any, limit) as any;
}
`;
fs.writeFileSync(workerMatchPath, workerContent);

// 3. Projector search
let projectorContent = fs.readFileSync(projectorSearchPath, 'utf8');

const startIdx = projectorContent.indexOf('import { localMatchEntries as sharedMatch');
const endIdx = projectorContent.indexOf('export function getProjectorSearchEndpoint()');

if (startIdx !== -1 && endIdx !== -1) {
  const head = projectorContent.substring(0, startIdx);
  const tail = projectorContent.substring(endIdx);

  const replacement = `import { localMatchEntries as sharedMatch } from '../../lib/localMatch';

function localMatchEntries(entries: ProjectorSearchEntry[], query: string): ProjectorSearchEntry[] {
  return sharedMatch(entries as any, query) as any;
}

`;

  fs.writeFileSync(projectorSearchPath, head + replacement + tail);
} else {
  console.log("Could not patch projectorSearchPath");
}

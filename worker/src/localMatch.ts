import type { EntrySnapshot } from './entryMerge'

/** Match journal entries locally (keyword + sentiment cues). Used to enrich AI Search. */
export function localMatchEntries(entries: EntrySnapshot[], query: string): EntrySnapshot[] {
  const q = query.trim().toLowerCase()
  if (!q || entries.length === 0) return []

  const wantsNeg = /\b(negative|negatives|bad|sad|down)\b/.test(q)
  const wantsPos = /\b(positive|positives|good|happy|upbeat)\b/.test(q)
  const wantsMixed = /\b(mixed|neutral|=)\b/.test(q)

  if (wantsNeg || wantsPos || wantsMixed) {
    return entries
      .filter((e) => {
        if (wantsNeg && e.sentiment === '-') return true
        if (wantsPos && e.sentiment === '+') return true
        if (wantsMixed && e.sentiment === '=') return true
        return false
      })
      .slice(0, 20)
  }

  const terms = q.split(/\s+/).filter((t) => t.length >= 2)
  if (terms.length === 0) return []

  return entries
    .filter((e) => {
      const hay =
        `${e.situation} ${e.details} ${e.behavioursNoted ?? ''} ${e.reoccurringTheme ?? ''} ${e.emotionNote ?? ''} ${e.emotion ?? ''} ${e.dateKey}`.toLowerCase()
      return terms.some((term) => hay.includes(term))
    })
    .slice(0, 20)
}

export function mergeEntrySnapshots(
  primary: EntrySnapshot[],
  secondary: EntrySnapshot[],
  limit = 20,
): EntrySnapshot[] {
  const seen = new Set<string>()
  const out: EntrySnapshot[] = []
  for (const e of [...primary, ...secondary]) {
    if (seen.has(e.id)) continue
    seen.add(e.id)
    out.push(e)
    if (out.length >= limit) break
  }
  return out
}

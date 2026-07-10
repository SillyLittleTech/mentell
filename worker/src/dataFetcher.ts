import { firestoreFetchEntriesByIds } from './firestoreAdmin'
import { pickNewerEntry, type EntrySnapshot } from './entryMerge'

export async function fetchEntriesByIds(options: {
  entryIds: string[]
  localEntries: EntrySnapshot[]
  userId?: string
  serviceAccountJson?: string
}): Promise<EntrySnapshot[]> {
  const localById = new Map(options.localEntries.map((e) => [e.id, e]))
  let remoteById = new Map<string, EntrySnapshot>()

  if (options.userId && options.serviceAccountJson) {
    try {
      const remote = await firestoreFetchEntriesByIds(
        options.serviceAccountJson,
        options.userId,
        options.entryIds,
      )
      remoteById = new Map(remote.map((e) => [e.id, e]))
    } catch (error) {
      console.warn('[mentell] data-fetcher Firestore lookup failed', error)
    }
  }

  const out: EntrySnapshot[] = []
  for (const id of options.entryIds) {
    const chosen = pickNewerEntry(localById.get(id), remoteById.get(id))
    if (chosen) out.push(chosen)
  }
  return out
}

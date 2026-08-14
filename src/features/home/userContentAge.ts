import { getDb } from '../../db/schema'

/** Earliest local journal/note/sticky/package timestamp, or null when Mentell has no prior content. */
export async function getOldestUserContentAt(): Promise<number | null> {
  const db = getDb()
  const [entry, note, sticky, pkg] = await Promise.all([
    db.entries.orderBy('createdAt').first(),
    db.notes.orderBy('createdAt').first(),
    db.stickies.orderBy('createdAt').first(),
    db.packages.orderBy('createdAt').first(),
  ])
  const times = [entry?.createdAt, note?.createdAt, sticky?.createdAt, pkg?.createdAt].filter(
    (value): value is number => typeof value === 'number',
  )
  if (times.length === 0) return null
  return Math.min(...times)
}

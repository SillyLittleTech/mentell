import { db, type EntryRow, type EntrySentiment, type WarningLevel } from '../../db/schema'
import { makeId } from '../../shared/id'

export type EntryDraft = {
  dateKey: string
  sentiment: EntrySentiment
  situation: string
  details: string
  flaggedTerms: string[]
  warningLevel: WarningLevel
  scoreDelta: number
  streakAtSubmit: number
}

export async function upsertEntryFromDraft(draft: EntryDraft) {
  const existing = await db.entries.where('dateKey').equals(draft.dateKey).first()
  const now = Date.now()

  const row: EntryRow = {
    id: existing?.id ?? makeId('entry'),
    createdAt: existing?.createdAt ?? now,
    dateKey: draft.dateKey,
    sentiment: draft.sentiment,
    situation: draft.situation,
    details: draft.details,
    flaggedTerms: draft.flaggedTerms,
    warningLevel: draft.warningLevel,
    scoreDelta: draft.scoreDelta,
    streakAtSubmit: draft.streakAtSubmit,
  }

  await db.entries.put(row)

  return row
}


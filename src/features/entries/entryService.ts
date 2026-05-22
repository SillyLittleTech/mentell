import {
  db,
  type EntryEmotion,
  type EntryRow,
  type EntrySentiment,
  type WarningLevel,
} from '../../db/schema'
import { makeId } from '../../shared/id'
import { notifyLocalDataChanged } from '../../shared/sync/localDataEvents'

export type EntryDraft = {
  dateKey: string
  sentiment: EntrySentiment
  emotion: EntryEmotion
  emotionNote: string
  situation: string
  details: string
  flaggedTerms: string[]
  warningLevel: WarningLevel
  scoreDelta: number
  streakAtSubmit: number
}

export async function upsertEntryFromDraft(draft: EntryDraft) {
  const now = Date.now()

  const row: EntryRow = {
    id: makeId('entry'),
    createdAt: now,
    updatedAt: now,
    dateKey: draft.dateKey,
    sentiment: draft.sentiment,
    emotion: draft.emotion,
    emotionNote: draft.emotionNote,
    situation: draft.situation,
    details: draft.details,
    flaggedTerms: draft.flaggedTerms,
    warningLevel: draft.warningLevel,
    scoreDelta: draft.scoreDelta,
    streakAtSubmit: draft.streakAtSubmit,
  }

  await db.entries.put(row)
  notifyLocalDataChanged()

  return row
}


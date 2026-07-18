import {
  getDb,
  type EntryEmotion,
  type EntryRow,
  type EntrySentiment,
  type RiskLevel,
  type WarningLevel,
} from '../../db/schema'
import { makeId } from '../../shared/id'
import { assertEntryFieldLimits } from '../../shared/limits/entryLimits'
import { notifyLocalDataChanged } from '../../shared/sync/localDataEvents'

export type EntryDraft = {
  dateKey: string
  sentiment: EntrySentiment
  emotion: EntryEmotion
  emotionNote: string
  situation: string
  details: string
  behavioursNoted: string
  reoccurringTheme: string
  flaggedTerms: string[]
  warningLevel: WarningLevel
  riskScore: number
  interventionScore: number
  riskLevel: RiskLevel
  scoreDelta: number
  streakAtSubmit: number
}

export async function upsertEntryFromDraft(draft: EntryDraft) {
  assertEntryFieldLimits(draft)

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
    behavioursNoted: draft.behavioursNoted,
    reoccurringTheme: draft.reoccurringTheme,
    flaggedTerms: draft.flaggedTerms,
    warningLevel: draft.warningLevel,
    riskScore: draft.riskScore,
    interventionScore: draft.interventionScore,
    riskLevel: draft.riskLevel,
    scoreDelta: draft.scoreDelta,
    streakAtSubmit: draft.streakAtSubmit,
  }

  await getDb().entries.put(row)
  notifyLocalDataChanged()

  return row
}

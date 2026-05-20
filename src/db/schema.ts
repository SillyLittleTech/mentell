import Dexie, { type Table } from 'dexie'

export type EntrySentiment = '+' | '-' | '='
export type WarningLevel = 'none' | 'warn'
export type EntryEmotion = 'happy' | 'calm' | 'anxious' | 'sad' | 'angry' | 'other'

export type EntryRow = {
  id: string
  createdAt: number
  dateKey: string // YYYY-MM-DD in local time
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

export type NoteTag = 'self' | 'therapist' | 'other'
export type NoteRow = {
  id: string
  createdAt: number
  title: string
  body: string
  tag: NoteTag
}

export type StickyRow = {
  id: string
  createdAt: number
  text: string
  x: number
  y: number
  color: string
  zIndex: number
}

export type PackageKind = 'weekly' | 'monthly' | 'yearly'
export type PackageRow = {
  id: string
  kind: PackageKind
  periodKey: string // e.g. 2026-W21, 2026-05, 2026
  createdAt: number
  openedAt?: number
  openedScoreDelta?: number
}

export class MentellDB extends Dexie {
  entries!: Table<EntryRow, string>
  notes!: Table<NoteRow, string>
  stickies!: Table<StickyRow, string>
  packages!: Table<PackageRow, string>

  constructor() {
    super('mentell')

    // v1: initial local-first tables
    this.version(1).stores({
      entries: '&id, dateKey, createdAt, sentiment, warningLevel',
      notes: '&id, createdAt, tag',
      stickies: '&id, createdAt, zIndex',
      packages: '&id, kind, periodKey, createdAt, openedAt',
    })

    // v2: add emotion fields on entries
    this.version(2)
      .stores({
        entries: '&id, dateKey, createdAt, sentiment, warningLevel',
        notes: '&id, createdAt, tag',
        stickies: '&id, createdAt, zIndex',
        packages: '&id, kind, periodKey, createdAt, openedAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table('entries')
          .toCollection()
          .modify((row: Partial<EntryRow>) => {
            if (!row.emotion) row.emotion = 'other'
            if (typeof row.emotionNote !== 'string') row.emotionNote = ''
          })
      })
  }
}

export const db = new MentellDB()


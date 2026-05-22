import type { EntryEmotion, EntrySentiment, WarningLevel } from '../../db/schema'

export type SharePreset = 'family' | 'friend' | 'professional' | 'custom'

export type SharePermissions = {
  showStreak: boolean
  showScore: boolean
  showEntryCounts: boolean
  showSentimentBreakdown: boolean
  showWarningsCount: boolean
  showRecentEntries: boolean
  showSituation: boolean
  showEmotion: boolean
  showEmotionNote: boolean
  showDetails: boolean
  showNotes: boolean
  maxDays: number
}

export type ShareEntryPreview = {
  id: string
  dateKey: string
  createdAt: number
  sentiment: EntrySentiment
  emotion?: EntryEmotion
  emotionNote?: string
  situation?: string
  details?: string
  warningLevel?: WarningLevel
}

export type ShareDashboardPayload = {
  generatedAt: number
  entryCount: number
  positives: number
  negatives: number
  mixed: number
  warnings: number
  streak?: number
  score?: number
  entries: ShareEntryPreview[]
}

export type ShareLinkRecord = {
  code: string
  shareUrl: string
  label: string
  preset: SharePreset
  permissions: SharePermissions
  ownerDisplayName: string
  createdAt: number
  expiresAt: number
}

export const SHARE_PRESETS: Record<SharePreset, SharePermissions> = {
  family: {
    showStreak: true,
    showScore: false,
    showEntryCounts: true,
    showSentimentBreakdown: true,
    showWarningsCount: false,
    showRecentEntries: true,
    showSituation: true,
    showEmotion: true,
    showEmotionNote: false,
    showDetails: false,
    showNotes: false,
    maxDays: 14,
  },
  friend: {
    showStreak: true,
    showScore: false,
    showEntryCounts: true,
    showSentimentBreakdown: true,
    showWarningsCount: false,
    showRecentEntries: false,
    showSituation: false,
    showEmotion: false,
    showEmotionNote: false,
    showDetails: false,
    showNotes: false,
    maxDays: 7,
  },
  professional: {
    showStreak: true,
    showScore: false,
    showEntryCounts: true,
    showSentimentBreakdown: true,
    showWarningsCount: true,
    showRecentEntries: true,
    showSituation: true,
    showEmotion: true,
    showEmotionNote: true,
    showDetails: false,
    showNotes: false,
    maxDays: 30,
  },
  custom: {
    showStreak: true,
    showScore: false,
    showEntryCounts: true,
    showSentimentBreakdown: true,
    showWarningsCount: false,
    showRecentEntries: true,
    showSituation: true,
    showEmotion: true,
    showEmotionNote: false,
    showDetails: false,
    showNotes: false,
    maxDays: 14,
  },
}

export function durationToMs(hours: number) {
  return hours * 60 * 60 * 1000
}

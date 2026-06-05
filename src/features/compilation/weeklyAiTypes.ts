import type { EntrySentiment } from '../../db/schema'

export type AiSummaryMode = 'reflection' | 'overview'

export type WeeklyAiSummaryEntry = {
  id?: string
  createdAt?: number
  dateKey: string
  sentiment: EntrySentiment
  emotion?: string
  emotionNote?: string
  situation?: string
  details?: string
}

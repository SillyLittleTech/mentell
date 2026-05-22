import { z } from 'zod'

export const EntrySentimentSchema = z.enum(['+', '-', '='])
export const WarningLevelSchema = z.enum(['none', 'warn'])
export const EntryEmotionSchema = z.enum(['happy', 'calm', 'anxious', 'sad', 'angry', 'other'])

export const EntryRowSchema = z.object({
  id: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sentiment: EntrySentimentSchema,
  emotion: EntryEmotionSchema,
  emotionNote: z.string(),
  situation: z.string(),
  details: z.string(),
  flaggedTerms: z.array(z.string()),
  warningLevel: WarningLevelSchema,
  scoreDelta: z.number().int(),
  streakAtSubmit: z.number().int().nonnegative(),
})

export const NoteTagSchema = z.enum(['self', 'therapist', 'other'])

export const NoteRowSchema = z.object({
  id: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  title: z.string(),
  body: z.string(),
  tag: NoteTagSchema,
})

export const StickyRowSchema = z.object({
  id: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  text: z.string(),
  x: z.number(),
  y: z.number(),
  color: z.string(),
  zIndex: z.number().int(),
})

export const PackageKindSchema = z.enum(['weekly', 'monthly', 'yearly'])

export const PackageRowSchema = z.object({
  id: z.string().min(1),
  kind: PackageKindSchema,
  periodKey: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  openedAt: z.number().int().nonnegative().optional(),
})


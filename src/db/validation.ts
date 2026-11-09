import { z } from "zod";

/** IndexedDB / validation export `EntrySentimentSchema`. */
export const EntrySentimentSchema = z.enum(["+", "-", "="]);
/** IndexedDB / validation export `WarningLevelSchema`. */
export const WarningLevelSchema = z.enum(["none", "warn"]);
/** IndexedDB / validation export `RiskLevelSchema`. */
export const RiskLevelSchema = z.enum(["none", "low", "elevated", "crisis"]);
/** IndexedDB / validation export `EntryEmotionSchema`. */
export const EntryEmotionSchema = z.enum([
  "happy",
  "calm",
  "anxious",
  "sad",
  "angry",
  "other",
]);

/** IndexedDB / validation export `EntryKindSchema`. */
export const EntryKindSchema = z.enum(["entry", "quick_log"]);

/** IndexedDB / validation export `EntryRowSchema`. */
export const EntryRowSchema = z.object({
  id: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  dateKey: z.string().regex(/^~?\d{4}-\d{2}-\d{2}$/),
  entryType: EntryKindSchema.optional(),
  sentiment: EntrySentimentSchema,
  emotion: EntryEmotionSchema,
  emotionNote: z.string(),
  situation: z.string(),
  details: z.string(),
  behavioursNoted: z.string().default(""),
  reoccurringTheme: z.string().default(""),
  quickLogNote: z.string().optional(),
  flaggedTerms: z.array(z.string()),
  warningLevel: WarningLevelSchema,
  riskScore: z.number().min(0).max(1),
  interventionScore: z.number(),
  riskLevel: RiskLevelSchema,
  scoreDelta: z.number().int(),
  streakAtSubmit: z.number().int().nonnegative(),
  hbcmAtSubmit: z.number().min(0).max(5).optional(),
});

/** IndexedDB / validation export `NoteTagSchema`. */
export const NoteTagSchema = z.enum(["self", "therapist", "other"]);

/** IndexedDB / validation export `NoteRowSchema`. */
export const NoteRowSchema = z.object({
  id: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  title: z.string(),
  body: z.string(),
  tag: NoteTagSchema,
});

/** IndexedDB / validation export `StickyRowSchema`. */
export const StickyRowSchema = z.object({
  id: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  text: z.string(),
  x: z.number(),
  y: z.number(),
  color: z.string(),
  zIndex: z.number().int(),
});

/** IndexedDB / validation export `PackageKindSchema`. */
export const PackageKindSchema = z.enum(["weekly", "monthly", "yearly"]);

/** IndexedDB / validation export `PackageRowSchema`. */
export const PackageRowSchema = z.object({
  id: z.string().min(1),
  kind: PackageKindSchema,
  periodKey: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  openedAt: z.number().int().nonnegative().optional(),
});

/** Max characters for journal compose fields (new writes). */
export const ENTRY_DETAILS_MAX = 10_000
export const ENTRY_SITUATION_MAX = 150
export const ENTRY_EMOTION_NOTE_MAX = 15

export function isOverLimit(value: string, max: number) {
  return value.length > max
}

export function draftFieldsOverLimit(draft: {
  situation: string
  details: string
  emotionNote?: string
}) {
  return (
    isOverLimit(draft.situation, ENTRY_SITUATION_MAX) ||
    isOverLimit(draft.details, ENTRY_DETAILS_MAX) ||
    isOverLimit(draft.emotionNote ?? '', ENTRY_EMOTION_NOTE_MAX)
  )
}

export function assertEntryFieldLimits(draft: {
  situation: string
  details: string
  emotionNote?: string
}) {
  if (draft.situation.length > ENTRY_SITUATION_MAX) {
    throw new Error(`Situation must be at most ${ENTRY_SITUATION_MAX} characters.`)
  }
  if (draft.details.length > ENTRY_DETAILS_MAX) {
    throw new Error(`Details must be at most ${ENTRY_DETAILS_MAX} characters.`)
  }
  if ((draft.emotionNote ?? '').length > ENTRY_EMOTION_NOTE_MAX) {
    throw new Error(`Emotion note must be at most ${ENTRY_EMOTION_NOTE_MAX} characters.`)
  }
}

export function styleForSentiment(sentiment: '+' | '-' | '=') {
  if (sentiment === '+') {
    return {
      borderColor: 'rgba(42,155,88,0.35)',
      background: 'rgba(42,155,88,0.1)',
    }
  }
  if (sentiment === '-') {
    return {
      borderColor: 'rgba(198,29,29,0.35)',
      background: 'rgba(198,29,29,0.1)',
    }
  }
  return {
    borderColor: 'rgba(224,178,44,0.35)',
    background: 'rgba(224,178,44,0.12)',
  }
}

const EMOTION_LABELS: Record<string, string> = {
  happy: 'Happy',
  calm: 'Calm',
  anxious: 'Anxious',
  sad: 'Sad',
  angry: 'Angry',
}

export function labelForEmotion(emotion: string) {
  return EMOTION_LABELS[emotion] || 'Other'
}

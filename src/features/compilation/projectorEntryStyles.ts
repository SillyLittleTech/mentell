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

export function labelForEmotion(emotion: string) {
  if (emotion === 'happy') return 'Happy'
  if (emotion === 'calm') return 'Calm'
  if (emotion === 'anxious') return 'Anxious'
  if (emotion === 'sad') return 'Sad'
  if (emotion === 'angry') return 'Angry'
  return 'Other'
}

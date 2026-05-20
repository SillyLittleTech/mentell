const DEFAULT_TERMS = [
  'suicide',
  'kill',
  'end it',
  'end my life',
  'die',
  'meds',
  'overdose',
  'hurt myself',
  'self harm',
]

export type FlagResult = {
  flaggedTerms: string[]
  warningLevel: 'none' | 'warn'
}

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

export function flagConcerningLanguage(text: string, terms: string[] = DEFAULT_TERMS): FlagResult {
  const normalized = normalize(text)
  if (!normalized) return { flaggedTerms: [], warningLevel: 'none' }

  const hits: string[] = []
  for (const raw of terms) {
    const t = normalize(raw)
    if (!t) continue
    if (normalized.includes(t)) hits.push(raw)
  }

  return { flaggedTerms: Array.from(new Set(hits)), warningLevel: hits.length ? 'warn' : 'none' }
}


export type AiProfileInput = {
  displayName?: string
  ageRange?: string
  about?: string
}

export type SanitizedProfile = {
  displayName: string
  ageRange: string
  about: string
}

const AGE_RANGES = new Set([
  '',
  'under18',
  '18-24',
  '25-34',
  '35-44',
  '45-54',
  '55+',
  'prefer-not',
])

/** Narrow patterns — avoid stripping legitimate phrases like "I act as a parent". */
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /disregard\s+(the\s+)?(above|prior)\s+instructions/i,
  /\bsystem\s*:\s*you\s+are/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
]

function stripControl(s: string) {
  return s.replace(/[\u0000-\u001F\u007F]/g, '')
}

export function sanitizeProfile(raw: AiProfileInput | undefined): SanitizedProfile {
  if (!raw || typeof raw !== 'object') {
    return { displayName: '', ageRange: 'prefer-not', about: '' }
  }

  let displayName = stripControl(String(raw.displayName ?? ''))
    .trim()
    .slice(0, 40)
    .replace(/[^a-zA-Z\u00C0-\u024F\s'\-]/g, '')
    .trim()

  let about = stripControl(String(raw.about ?? ''))
    .trim()
    .slice(0, 500)
    .replace(/[<>]/g, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')

  for (const pattern of INJECTION_PATTERNS) {
    about = about.replace(pattern, '')
  }
  about = about.trim()

  const ageRange = AGE_RANGES.has(String(raw.ageRange ?? ''))
    ? String(raw.ageRange)
    : 'prefer-not'

  return { displayName, ageRange, about }
}

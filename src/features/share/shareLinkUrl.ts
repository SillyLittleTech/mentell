import { publicUrl } from '../../shared/publicUrl'

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export function normalizeShareCode(code: string) {
  return code.replace(/\s+/g, '').replace(/-/g, '').toUpperCase()
}

export function formatShareCode(raw: string) {
  const clean = normalizeShareCode(raw)
  const parts: string[] = []
  for (let i = 0; i < clean.length; i += 4) {
    parts.push(clean.slice(i, i + 4))
  }
  return parts.join('-')
}

<<<<<<< Updated upstream
export function normalizeShareSlug(raw: string) {
  return raw.trim()
}

export function shareDocIdCandidates(raw: string) {
  const exact = normalizeShareSlug(raw)
  const legacy = formatShareCode(raw)
  return exact === legacy ? [exact] : [exact, legacy]
}

=======
>>>>>>> Stashed changes
export function generateShareCode() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let raw = ''
  for (let i = 0; i < bytes.length; i++) {
    raw += CROCKFORD[bytes[i]! % 32]
  }
  return formatShareCode(raw)
}

<<<<<<< Updated upstream
export function buildShareUrlForCode(code: string) {
=======
export function buildShareUrl(code: string) {
>>>>>>> Stashed changes
  const normalized = formatShareCode(code)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const path = publicUrl(`share/${normalized}`)
  const joined = path.startsWith('/') ? path : `/${path}`
  return `${origin}${joined}`
}
<<<<<<< Updated upstream

export function buildShareUrlForSlug(slug: string) {
  const normalized = normalizeShareSlug(slug)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const path = publicUrl(`share/${encodeURIComponent(normalized)}`)
  const joined = path.startsWith('/') ? path : `/${path}`
  return `${origin}${joined}`
}

export function buildShareUrl(code: string) {
  return buildShareUrlForCode(code)
}
=======
>>>>>>> Stashed changes

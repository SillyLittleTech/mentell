import { publicUrl } from '../../shared/publicUrl'
import { isOfflineZipBuild } from '../../shared/platform/runtime'

export const CRYPT_SHARE_SLUG = 'cryptl'

/** Conservative QR capacity for level L; larger snapshots fall back to copy/paste. */
const QR_MAX_CHARS = 1800

export function encodeCryptCode(payloadBase64Url: string, keyBase64Url: string): string {
  const params = new URLSearchParams()
  params.set('payload', payloadBase64Url)
  params.set('key', keyBase64Url)
  return params.toString()
}

export function canEncodeQrValue(value: string): boolean {
  return value.length > 0 && value.length <= QR_MAX_CHARS
}

function paramsFromQueryLike(raw: string): { payload: string | null; key: string | null } {
  const trimmed = raw.trim()
  if (!trimmed) return { payload: null, key: null }
  const withoutPrefix = trimmed.startsWith('#') || trimmed.startsWith('?') ? trimmed.slice(1) : trimmed
  const query = withoutPrefix.includes('?') ? withoutPrefix.slice(withoutPrefix.indexOf('?') + 1) : withoutPrefix
  const params = new URLSearchParams(query)
  return {
    payload: params.get('payload'),
    key: params.get('key'),
  }
}

export function parseCryptCode(raw: string): { payloadBase64Url: string; keyBase64Url: string } {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error('Invalid crypto code format.')
  }

  const candidates: string[] = [trimmed]

  try {
    const url = new URL(trimmed)
    if (url.search) candidates.push(url.search)
    if (url.hash) candidates.push(url.hash)
  } catch {
    /* not an absolute URL */
  }

  const hashIdx = trimmed.indexOf('#')
  if (hashIdx >= 0) candidates.push(trimmed.slice(hashIdx))
  const queryIdx = trimmed.indexOf('?')
  if (queryIdx >= 0) candidates.push(trimmed.slice(queryIdx))

  for (const candidate of candidates) {
    const { payload, key } = paramsFromQueryLike(candidate)
    if (payload && key) {
      return { payloadBase64Url: payload, keyBase64Url: key }
    }
  }

  throw new Error('Invalid crypto code format.')
}

export function buildCryptShareUrl(payloadBase64Url: string, keyBase64Url: string): string {
  const fragment = encodeCryptCode(payloadBase64Url, keyBase64Url)
  if (typeof window === 'undefined') {
    return `#${fragment}`
  }

  if (isOfflineZipBuild()) {
    const { origin, pathname } = window.location
    return `${origin}${pathname}#/share/${CRYPT_SHARE_SLUG}?${fragment}`
  }

  const origin = window.location.origin
  const path = publicUrl(`share/${CRYPT_SHARE_SLUG}`)
  const joined = path.startsWith('/') ? path : `/${path}`
  return `${origin}${joined}#${fragment}`
}

export function cryptCodeFromLocation(loc: Pick<Location, 'href' | 'search' | 'hash'> = window.location): string | null {
  for (const candidate of [loc.href, loc.hash, loc.search]) {
    if (!candidate) continue
    try {
      const parsed = parseCryptCode(candidate)
      return encodeCryptCode(parsed.payloadBase64Url, parsed.keyBase64Url)
    } catch {
      /* try next */
    }
  }
  return null
}

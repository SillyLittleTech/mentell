const FIREBASE_LINK_PARAMS = [
  'oobCode',
  'mode',
  'apiKey',
  'lang',
  'continueUrl',
  'tenantId',
] as const

/** Merge query params from search and hash (HashRouter / email links). */
export function getMergedUrlParams(): URLSearchParams {
  const merged = new URLSearchParams(window.location.search)
  const hash = window.location.hash
  if (hash.includes('?')) {
    const hashQuery = hash.slice(hash.indexOf('?') + 1)
    const hashParams = new URLSearchParams(hashQuery)
    hashParams.forEach((value, key) => merged.set(key, value))
  }
  return merged
}

export function currentPageHasFirebaseEmailLinkParams(): boolean {
  if (typeof window === 'undefined') return false
  const params = getMergedUrlParams()
  return params.has('oobCode') && params.get('mode') === 'signIn'
}

export function buildHrefForEmailLinkCheck(): string {
  if (typeof window === 'undefined') return ''
  if (currentPageHasFirebaseEmailLinkParams() && !window.location.search.includes('oobCode=')) {
    const params = getMergedUrlParams()
    const url = new URL(window.location.href.split('#')[0] || window.location.origin)
    params.forEach((value, key) => url.searchParams.set(key, value))
    return url.toString()
  }
  return window.location.href
}

/** Build settings route path preserving Firebase email-link query params (React Router path). */
export function buildSettingsPathWithLinkParams(): string {
  const params = getMergedUrlParams()
  if (!params.has('oobCode')) return '/settings'
  return `/settings?${params.toString()}`
}

/** True when the email link was started from an offline ZIP / file:// build. */
export function isOfflineEmailLinkHandoff(): boolean {
  if (typeof window === 'undefined') return false
  return getMergedUrlParams().get('offline') === '1'
}

/** Build a mentell:// deep link that carries the Firebase email sign-in URL. */
export function buildMentellEmailDeepLink(pageUrl: string): string {
  const deepLink = new URL('mentell://auth/email')
  deepLink.searchParams.set('link', pageUrl)

  try {
    const url = new URL(pageUrl)
    const params = new URLSearchParams(url.search)
    for (const key of FIREBASE_LINK_PARAMS) {
      const value = params.get(key)
      if (value) deepLink.searchParams.set(key, value)
    }
  } catch {
    const params = getMergedUrlParams()
    for (const key of FIREBASE_LINK_PARAMS) {
      const value = params.get(key)
      if (value) deepLink.searchParams.set(key, value)
    }
  }

  return deepLink.toString()
}

const FIREBASE_LINK_PARAMS = [
  'oobCode',
  'mode',
  'apiKey',
  'lang',
  'continueUrl',
  'tenantId',
] as const

/** Build a mentell:// deep link that carries the Firebase email sign-in URL. */
export function buildMentellEmailDeepLink(pageUrl: string): string {
  const deepLink = new URL('mentell://auth/email')
  deepLink.searchParams.set('link', pageUrl)

  try {
    const params = new URL(pageUrl).searchParams
    for (const key of FIREBASE_LINK_PARAMS) {
      const value = params.get(key)
      if (value) deepLink.searchParams.set(key, value)
    }
  } catch {
    // ignore malformed URLs
  }

  return deepLink.toString()
}

export function currentPageHasFirebaseEmailLinkParams(): boolean {
  if (typeof window === 'undefined') return false
  const href = window.location.href
  const search = window.location.search
  const hash = window.location.hash
  return (
    href.includes('oobCode=') &&
    href.includes('mode=') &&
    (search.includes('mode=signIn') || hash.includes('mode=signIn'))
  )
}

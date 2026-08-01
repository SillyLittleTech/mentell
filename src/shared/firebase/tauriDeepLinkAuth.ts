import { isSignInWithEmailLink } from 'firebase/auth'
import type { Auth } from 'firebase/auth'
import { getCurrent, onOpenUrl } from '@tauri-apps/plugin-deep-link'
import { isTauri } from '../platform/runtime'

const EMAIL_LINK_PARAM = 'link'

function emailLinkFromDeepLink(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'mentell:') return null
    const host = parsed.hostname || parsed.pathname.replace(/^\//, '')
    if (host !== 'auth' && !parsed.pathname.startsWith('/auth/')) return null
    const link = parsed.searchParams.get(EMAIL_LINK_PARAM)
    return link?.trim() || null
  } catch {
    return null
  }
}

export async function installTauriDeepLinkAuth(
  auth: Auth,
  onEmailLink: (link: string) => void,
): Promise<() => void> {
  if (!isTauri()) return () => undefined

  const handleUrls = (urls: string[]) => {
    for (const url of urls) {
      const link = emailLinkFromDeepLink(url)
      if (link && isSignInWithEmailLink(auth, link)) {
        onEmailLink(link)
      }
    }
  }

  const current = await getCurrent()
  if (current?.length) handleUrls(current)

  return onOpenUrl(handleUrls)
}

import { isSignInWithEmailLink } from 'firebase/auth'
import type { Auth } from 'firebase/auth'
import { getCurrent, onOpenUrl } from '@tauri-apps/plugin-deep-link'
import { getFirebaseWebConfig } from './config'
import { isTauri } from '../platform/runtime'

const EMAIL_LINK_PARAM = 'link'
const FIREBASE_LINK_PARAMS = ['oobCode', 'mode', 'apiKey', 'lang', 'continueUrl', 'tenantId'] as const

function reconstructFirebaseEmailLink(params: URLSearchParams): string | null {
  const oobCode = params.get('oobCode')
  const mode = params.get('mode')
  const apiKey = params.get('apiKey')
  if (!oobCode || !mode || !apiKey) return null

  const config = getFirebaseWebConfig()
  if (!config?.authDomain) return null
  const host = config.authDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const link = new URL(`https://${host}/__/auth/action`)
  for (const key of FIREBASE_LINK_PARAMS) {
    const value = params.get(key)
    if (value) link.searchParams.set(key, value)
  }
  return link.toString()
}

function emailLinkFromDeepLink(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'mentell:') return null

    const host = parsed.hostname || parsed.pathname.replace(/^\//, '').split('/')[0]
    const isAuthHost =
      host === 'auth' ||
      parsed.pathname.startsWith('/auth/') ||
      parsed.pathname.startsWith('//auth/')

    if (!isAuthHost) return null

    const embedded = parsed.searchParams.get(EMAIL_LINK_PARAM)
    if (embedded?.trim()) return embedded.trim()

    return reconstructFirebaseEmailLink(parsed.searchParams)
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

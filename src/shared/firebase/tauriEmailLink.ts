import type { ActionCodeSettings } from 'firebase/auth'
import { isSignInWithEmailLink, type Auth } from 'firebase/auth'
import { getFirebaseWebConfig } from './config'
import {
  localhostContinueUrl,
  startAuthCallbackServer,
  waitForAuthCallback,
} from './tauriAuthCallback'

export async function buildTauriEmailLinkSettings(): Promise<{
  settings: ActionCodeSettings
  waitForLink: () => Promise<string>
}> {
  const port = await startAuthCallbackServer()
  const continueUrl = localhostContinueUrl(port)
  const settings: ActionCodeSettings = {
    url: continueUrl,
    handleCodeInApp: true,
  }

  const config = getFirebaseWebConfig()
  if (config?.authDomain) {
    const host = config.authDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')
    if (!host.endsWith('.firebaseapp.com')) {
      settings.linkDomain = host
    }
  }

  return {
    settings,
    waitForLink: () => waitForAuthCallback(port),
  }
}

export async function waitForTauriEmailLinkCompletion(
  auth: Auth,
  linkPromise: Promise<string>,
): Promise<string> {
  const linkUrl = await linkPromise
  if (!isSignInWithEmailLink(auth, linkUrl)) {
    throw new Error('The sign-in link was invalid or expired. Request a new one.')
  }
  return linkUrl
}

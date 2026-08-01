import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { isTauri } from '../platform/runtime'

const AUTH_CALLBACK_EVENT = 'auth-callback'

export async function startAuthCallbackServer(): Promise<number> {
  if (!isTauri()) {
    throw new Error('Auth callback server is only available in the desktop app')
  }
  return invoke<number>('start_auth_callback')
}

export async function stopAuthCallbackServer(): Promise<void> {
  if (!isTauri()) return
  await invoke('stop_auth_callback')
}

export function localhostContinueUrl(port: number): string {
  return `http://127.0.0.1:${port}`
}

/** Wait for a single auth callback URL from the localhost server. */
export async function waitForAuthCallback(port: number, timeoutMs = 300_000): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let unlisten: (() => void) | undefined

    const timeout = window.setTimeout(() => {
      if (unlisten) void unlisten()
      void stopAuthCallbackServer()
      reject(new Error('Sign-in timed out. Try again.'))
    }, timeoutMs)

    void listen<string>(AUTH_CALLBACK_EVENT, (event) => {
      const url = event.payload
      if (!url.includes(`127.0.0.1:${port}`) && !url.includes(`localhost:${port}`)) return
      window.clearTimeout(timeout)
      if (unlisten) void unlisten()
      void stopAuthCallbackServer()
      resolve(url)
    })
      .then((remove) => {
        unlisten = remove
      })
      .catch((error) => {
        window.clearTimeout(timeout)
        reject(error instanceof Error ? error : new Error(String(error)))
      })
  })
}

import { useEffect, useRef } from 'react'
import { useToast } from '../../shared/ui/useToast'
import { appVersion } from '../../shared/version'

// Use the public GitHub repo raw URL for the VERSION file
const VERSION_URL = 'https://raw.githubusercontent.com/SillyLittleTech/mentell/main/VERSION'
const RELEASES_URL = 'https://github.com/SillyLittleTech/mentell/releases/latest'
const CHECK_INTERVAL = 60 * 60 * 1000 // 1 hour in ms

function isLocalVersion() {
  // Check for Tauri or Capacitor indicating a local (desktop/mobile) app
  // @ts-expect-error - __TAURI__ is injected globally by Tauri
  const hasTauri = !!window.__TAURI__
  // @ts-expect-error - Capacitor is injected globally by Capacitor
  const hasCapacitor = !!window.Capacitor
  return hasTauri || hasCapacitor
}

function parseVersion(versionString: string) {
  // Returns [major, minor, patch] or null
  const match = versionString.trim().match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!match) return null
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)]
}

function isNewer(latest: string, current: string) {
  const latestParts = parseVersion(latest)
  const currentParts = parseVersion(current)
  if (!latestParts || !currentParts) return false

  for (let i = 0; i < 3; i++) {
    if (latestParts[i] > currentParts[i]) return true
    if (latestParts[i] < currentParts[i]) return false
  }
  return false
}

export function UpdateChecker() {
  const { showToast } = useToast()
  const toastIdRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    async function checkForUpdates() {
      try {
        const response = await fetch(VERSION_URL, { cache: 'no-store' })
        if (!response.ok) return

        const latestVersion = await response.text()

        if (isNewer(latestVersion, appVersion)) {
          // If we already showed a toast, don't show another one.
          if (toastIdRef.current) return

          const local = isLocalVersion()

          const messageNode = local ? (
            <span>
              A new version of Mentell is available! Please{' '}
              <a
                href={RELEASES_URL}
                target="_blank"
                rel="noreferrer"
                className="underline hover:opacity-80"
              >
                update from GitHub
              </a>{' '}
              to avoid things breaking.
            </span>
          ) : (
            'A new version of Mentell is available! Please refresh the page to avoid things breaking.'
          )

          toastIdRef.current = showToast({
            message: messageNode,
            isSticky: true,
          })
        }
      } catch {
        // Ignore fetch errors (e.g. offline)
      }
    }

    // Check immediately on mount
    void checkForUpdates()

    // And then every hour
    const interval = setInterval(() => {
      void checkForUpdates()
    }, CHECK_INTERVAL)

    return () => {
      clearInterval(interval)
    }
  }, [showToast])

  return null
}

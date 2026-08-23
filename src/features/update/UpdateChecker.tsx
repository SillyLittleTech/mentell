import { useEffect, useRef, useState } from 'react'
import { isNativeShell, isTauri } from '../../shared/platform/runtime'
import { useToast } from '../../shared/ui/useToast'
import { appVersion } from '../../shared/version'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

// Use the public GitHub repo raw URL for the VERSION file
const VERSION_URL = 'https://raw.githubusercontent.com/SillyLittleTech/mentell/main/VERSION'
const RELEASES_URL = 'https://github.com/SillyLittleTech/mentell/releases/latest'
const CHECK_INTERVAL = 60 * 60 * 1000 // 1 hour in ms

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

function FallbackMessage() {
  return (
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
  )
}

function WebMessage() {
  return (
    <span>
      A new version of Mentell is available! Please refresh the page to avoid things breaking.
    </span>
  )
}

function TauriUpdateUI({ update, onFail }: { update: any; onFail: () => void }) {
  const [status, setStatus] = useState<'idle' | 'downloading' | 'ready'>('idle')
  const [progress, setProgress] = useState(0)

  async function handleUpdate() {
    try {
      setStatus('downloading')
      setProgress(0)

      let downloaded = 0
      let total = 0

      await update.downloadAndInstall((event: any) => {
        if (event.event === 'Started' && event.data.contentLength) {
          total = event.data.contentLength
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength
          if (total > 0) {
            setProgress(Math.round((downloaded / total) * 100))
          }
        } else if (event.event === 'Finished') {
          setProgress(100)
        }
      })
      setStatus('ready')
    } catch (e) {
      console.error('Update failed:', e)
      onFail()
    }
  }

  if (status === 'ready') {
    return (
      <div className="flex flex-col gap-2">
        <span>Update ready!</span>
        <button
          onClick={() => relaunch()}
          className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 focus-ring"
        >
          Restart to apply
        </button>
      </div>
    )
  }

  if (status === 'downloading') {
    return (
      <div className="flex w-full flex-col gap-2 min-w-[200px]">
        <div className="flex justify-between text-sm">
          <span>Downloading update...</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--paper-border)]">
          <div
            className="h-full bg-[var(--accent)] transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <span>A new version ({update.version}) is available!</span>
      <button
        onClick={handleUpdate}
        className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 focus-ring w-fit"
      >
        Update now
      </button>
    </div>
  )
}

export function UpdateChecker() {
  const { showToast, updateToast } = useToast()
  const toastIdRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    async function checkForUpdates() {
      try {
        const response = await fetch(VERSION_URL, { cache: 'no-store' })
        if (!response.ok) return

        const latestVersion = await response.text()

        if (isNewer(latestVersion, appVersion)) {
          if (toastIdRef.current) return

          const local = isNativeShell()

          if (local && isTauri()) {
            try {
              const update = await check()
              if (update) {
                const id = showToast({
                  message: (
                    <TauriUpdateUI
                      update={update}
                      onFail={() => {
                        updateToast(id, { message: <FallbackMessage /> })
                      }}
                    />
                  ),
                  isSticky: true,
                })
                toastIdRef.current = id
                return
              }
            } catch (e) {
              console.error('Failed to check for Tauri updates:', e)
              // Fall through to default fallback
            }
          }

          const messageNode = local ? <FallbackMessage /> : <WebMessage />

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
  }, [showToast, updateToast])

  return null
}

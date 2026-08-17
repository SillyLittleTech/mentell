import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { createOfflineSyncPayload, type OfflineSyncPayload } from '../sync/cryptSync'
import { getDb } from '../../db/schema'
import { loadAppSettings } from '../../shared/settings/appSettings'
import { getEffectiveGlobalName } from '../../shared/settings/effectiveGlobalName'
import { useAuthOptional } from '../../shared/firebase/AuthProvider'

export function SyncDownModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const auth = useAuthOptional()
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [qrPayload, setQrPayload] = useState<string | null>(null)
  const [rawText, setRawText] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      const timeoutId = setTimeout(() => {
        setBusy(true)
        setError(null)
        setQrPayload(null)
        setRawText(null)
      }, 0);
      return () => clearTimeout(timeoutId)
    }

    async function generate() {
      try {
        const db = getDb()
        const entries = await db.entries.toArray()
        const notes = await db.notes.toArray()
        const packages = await db.packages.toArray()
        const stickies = await db.stickies.toArray()
        const settings = loadAppSettings()

        const displayName = getEffectiveGlobalName()
        const identifier = auth?.user?.email || null

        const payload: OfflineSyncPayload = {
          version: 1,
          createdAt: Date.now(),
          expiresAt: null, // Never expires for device sync
          sender: {
            displayName,
            identifier,
          },
          data: {
            entries,
            notes,
            packages,
            stickies,
            settings,
          }
        }

        const { payloadBase64Url, keyBase64Url } = await createOfflineSyncPayload(payload)

        // Compact format for QR: p={payload}&k={key}
        // This keeps it minimal. For manual copying, we can just join them or format as a JSON.
        // The spec mentions url hash fragments `#payload=...&key=...` or "raw base64url string".
        // Let's use a simple query-like string `payload=${payloadBase64Url}&key=${keyBase64Url}`
        const code = `payload=${payloadBase64Url}&key=${keyBase64Url}`
        setQrPayload(code)
        setRawText(code)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Export failed')
      } finally {
        setBusy(false)
      }
    }

    void generate()
  }, [open, auth?.user?.email])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="paper w-full max-w-md rounded-3xl p-6 shadow-2xl">
        <h2 className="font-paper text-2xl">Sync Down (Export)</h2>
        <p className="ink-muted mt-2 text-sm">
          Scan this QR code from another device to copy your local data directly over.
        </p>

        {busy ? (
          <div className="mt-6 flex h-48 items-center justify-center text-sm">
            Compressing and encrypting data...
          </div>
        ) : error ? (
          <div className="mt-6 text-sm" style={{ color: 'var(--danger)' }}>
            {error}
          </div>
        ) : qrPayload ? (
          <div className="mt-6 flex flex-col items-center gap-4">
            <div className="rounded-2xl bg-white p-4">
              <QRCodeSVG value={qrPayload} size={256} level="L" />
            </div>

            <button
              type="button"
              className="focus-ring w-full rounded-2xl border border-[var(--paper-border)] px-4 py-2 text-sm font-semibold"
              onClick={async () => {
                if (rawText) {
                  await navigator.clipboard.writeText(rawText)
                  alert('Crypto code copied to clipboard!')
                }
              }}
            >
              Copy Crypto Code
            </button>
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="focus-ring rounded-xl px-4 py-2 text-sm"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

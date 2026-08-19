import { useState, useEffect } from 'react'
import { createOfflineSyncPayload, type OfflineSyncPayload } from '../sync/cryptSync'
import {
  buildCryptShareUrl,
  canEncodeQrValue,
  encodeCryptCode,
} from '../sync/cryptCode'
import { CryptQrBlock } from '../sync/CryptQrBlock'
import { getDb } from '../../db/schema'
import { loadAppSettings } from '../../shared/settings/appSettings'
import { getEffectiveGlobalName } from '../../shared/settings/effectiveGlobalName'
import { useAuthOptional } from '../../shared/firebase/AuthProvider'
import { useToast } from '../../shared/ui/useToast'

export function SyncDownModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const auth = useAuthOptional()
  const { showToast } = useToast()
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [qrPayload, setQrPayload] = useState<string | null>(null)
  const [rawText, setRawText] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      const timeoutId = setTimeout(() => {
        setBusy(true)
        setError(null)
        setQrPayload(null)
        setRawText(null)
        setShareUrl(null)
      }, 0)
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
          expiresAt: null,
          sender: {
            displayName: displayName || null,
            identifier,
          },
          data: {
            entries,
            notes,
            packages,
            stickies,
            settings,
          },
        }

        const { payloadBase64Url, keyBase64Url } = await createOfflineSyncPayload(payload)
        const code = encodeCryptCode(payloadBase64Url, keyBase64Url)
        setRawText(code)
        setShareUrl(buildCryptShareUrl(payloadBase64Url, keyBase64Url))
        setQrPayload(canEncodeQrValue(code) ? code : null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Export failed')
      } finally {
        setBusy(false)
      }
    }

    void generate()
  }, [open, auth?.user?.email])

  async function copyText(value: string, message: string) {
    try {
      await navigator.clipboard.writeText(value)
      showToast({ message })
    } catch {
      showToast({ message: 'Copy failed — select the text manually', duration: 0 })
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="paper w-full max-w-md rounded-3xl p-6 shadow-2xl">
        <h2 className="font-paper text-2xl">Sync down (export)</h2>
        <p className="ink-muted mt-2 text-sm">
          Scan this QR from another Mentell device, or copy the crypto code. Nothing is uploaded.
        </p>

        {busy ? (
          <div className="mt-6 flex h-48 items-center justify-center text-sm">
            Compressing and encrypting data...
          </div>
        ) : error ? (
          <div className="mt-6 text-sm" style={{ color: 'var(--danger)' }}>
            {error}
          </div>
        ) : (
          <div className="mt-6 flex flex-col items-center gap-4">
            {qrPayload ? <CryptQrBlock value={qrPayload} /> : <CryptQrBlock value="" />}
            {rawText ? (
              <button
                type="button"
                className="focus-ring w-full rounded-2xl border border-[var(--paper-border)] px-4 py-2 text-sm font-semibold"
                onClick={() => void copyText(rawText, 'Crypto code copied')}
              >
                Copy crypto code
              </button>
            ) : null}
            {shareUrl ? (
              <button
                type="button"
                className="focus-ring w-full rounded-2xl border border-[var(--paper-border)] px-4 py-2 text-sm"
                onClick={() => void copyText(shareUrl, 'Link copied')}
              >
                Copy open-in-app link
              </button>
            ) : null}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="focus-ring rounded-xl px-4 py-2 text-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

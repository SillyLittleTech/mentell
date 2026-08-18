import { useState, useEffect } from 'react'
import {
  decryptOfflineSyncPayload,
  isOfflineSyncData,
  isShareDashboardPayload,
  type OfflineSyncPayload,
} from '../sync/cryptSync'
import { mergeOfflineSyncData, replaceOfflineSyncData } from '../sync/syncMerge'
import { buildCryptShareUrl, parseCryptCode } from '../sync/cryptCode'
import { CryptCodeEntry } from '../sync/CryptCodeEntry'
import { OfflineSyncImportConfirm } from '../sync/OfflineSyncImportConfirm'
import { useToast } from '../../shared/ui/useToast'

export function SyncUpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{
    payload: OfflineSyncPayload
    entryCount: number
    code: string
  } | null>(null)

  useEffect(() => {
    if (!open) {
      const timeoutId = setTimeout(() => {
        setPreview(null)
        setError(null)
        setBusy(false)
      }, 0)
      return () => clearTimeout(timeoutId)
    }
  }, [open])

  async function handleCode(code: string) {
    if (!code.trim()) return
    setBusy(true)
    setError(null)
    try {
      const { payloadBase64Url, keyBase64Url } = parseCryptCode(code)
      const payload = await decryptOfflineSyncPayload(payloadBase64Url, keyBase64Url)
      let entryCount = 0
      if (isOfflineSyncData(payload.data)) {
        entryCount = payload.data.entries.length
      } else if (isShareDashboardPayload(payload.data)) {
        entryCount = payload.data.entryCount
      }
      setPreview({ payload, entryCount, code })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to decrypt payload')
    } finally {
      setBusy(false)
    }
  }

  async function applyImport(mode: 'merge' | 'replace') {
    if (!preview || !isOfflineSyncData(preview.payload.data)) return
    setBusy(true)
    setError(null)
    try {
      if (mode === 'replace') await replaceOfflineSyncData(preview.payload.data)
      else await mergeOfflineSyncData(preview.payload.data)
      showToast({
        message: mode === 'replace' ? 'This device now matches the snapshot' : 'Snapshot merged',
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : mode === 'replace' ? 'Replace failed' : 'Merge failed')
    } finally {
      setBusy(false)
    }
  }

  function openAsShare() {
    if (!preview) return
    const { payloadBase64Url, keyBase64Url } = parseCryptCode(preview.code)
    window.location.assign(buildCryptShareUrl(payloadBase64Url, keyBase64Url))
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="paper w-full max-w-md rounded-3xl p-6 shadow-2xl">
        <h2 className="font-paper text-2xl">Sync up (import)</h2>

        {preview ? (
          isShareDashboardPayload(preview.payload.data) ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-[var(--paper-border)] p-4 text-sm">
                <div className="mb-2 font-bold">This is a share snapshot</div>
                <div className="italic">
                  Open it as a read-only shared view instead of importing a full journal.
                </div>
              </div>
              {error ? (
                <div className="text-sm" style={{ color: 'var(--danger)' }}>
                  {error}
                </div>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="focus-ring w-full rounded-2xl border border-[var(--paper-border)] px-4 py-2 text-sm font-semibold"
                  onClick={openAsShare}
                >
                  Open shared view
                </button>
                <button
                  type="button"
                  className="focus-ring w-full rounded-2xl border border-[var(--paper-border)] px-4 py-2 text-sm"
                  onClick={() => setPreview(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <OfflineSyncImportConfirm
              payload={preview.payload}
              entryCount={preview.entryCount}
              busy={busy}
              error={error}
              onMerge={() => void applyImport('merge')}
              onReplace={() => void applyImport('replace')}
              onCancel={() => setPreview(null)}
            />
          )
        ) : (
          <>
            <CryptCodeEntry busy={busy} error={error} onCode={(code) => void handleCode(code)} />
            <div className="mt-4 flex justify-end gap-3">
              <button type="button" className="focus-ring rounded-xl px-4 py-2 text-sm" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

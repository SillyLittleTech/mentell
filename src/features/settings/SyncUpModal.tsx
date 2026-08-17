import { useState, useEffect } from 'react'
import { Scanner } from '@yudiel/react-qr-scanner'
import { decryptOfflineSyncPayload, type OfflineSyncPayload, type OfflineSyncData } from '../sync/cryptSync'
import { mergeOfflineSyncData } from '../sync/syncMerge'
import { format } from 'date-fns'
import type { ShareDashboardPayload } from '../share/shareTypes'

export function SyncUpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<'scan' | 'paste'>('scan')
  const [pastedCode, setPastedCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [preview, setPreview] = useState<{ payload: OfflineSyncPayload, entryCount: number } | null>(null)

  useEffect(() => {
    if (!open) {
      const timeoutId = setTimeout(() => {
        setPreview(null)
        setPastedCode('')
        setError(null)
      }, 0);
      return () => clearTimeout(timeoutId)
    }
  }, [open])

  async function handleCode(code: string) {
    if (!code) return
    setBusy(true)
    setError(null)
    try {
      const params = new URLSearchParams(code)
      let payloadBase64Url = params.get('payload')
      let keyBase64Url = params.get('key')

      // Fallback if the user just pasted `#payload=...&key=...`
      if (!payloadBase64Url && code.includes('payload=')) {
        const hashParams = new URLSearchParams(code.split('#')[1] || code)
        payloadBase64Url = hashParams.get('payload')
        keyBase64Url = hashParams.get('key')
      }

      if (!payloadBase64Url || !keyBase64Url) {
        throw new Error('Invalid crypto code format.')
      }

      const payload = await decryptOfflineSyncPayload(payloadBase64Url, keyBase64Url)

      let entryCount = 0
      if ('entries' in payload.data) {
        entryCount = (payload.data as OfflineSyncData).entries.length
      } else if ('generatedAt' in payload.data) {
        entryCount = (payload.data as ShareDashboardPayload).entryCount
      }

      setPreview({ payload, entryCount })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to decrypt payload')
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirm() {
    if (!preview) return
    setBusy(true)
    try {
      if ('entries' in preview.payload.data) {
        await mergeOfflineSyncData(preview.payload.data as OfflineSyncData)
        alert('Data merged successfully!')
        onClose()
      } else {
        setError('This code appears to be a Share link, not a full Device Sync export.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Merge failed')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="paper w-full max-w-md rounded-3xl p-6 shadow-2xl">
        <h2 className="font-paper text-2xl">Sync Up (Import)</h2>

        {preview ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-[var(--paper-border)] p-4 text-sm">
              <div className="mb-2 font-bold">Import Sync Data?</div>
              <div className="mb-1"><span className="font-semibold">Source:</span> {preview.payload.sender.displayName || 'Unknown'} {preview.payload.sender.identifier ? `(${preview.payload.sender.identifier})` : ''}</div>
              <div className="mb-1"><span className="font-semibold">Created:</span> {format(preview.payload.createdAt, 'PPp')}</div>
              <div className="mb-2"><span className="font-semibold">Payload:</span> Found {preview.entryCount} entries and settings to merge</div>
              <div className="italic">Are you sure you want to merge this data into your local journal?</div>
            </div>
            {error && <div className="text-sm" style={{ color: 'var(--danger)' }}>{error}</div>}

            <div className="flex gap-2">
              <button
                type="button"
                className="focus-ring w-full rounded-2xl border border-[var(--paper-border)] px-4 py-2 text-sm font-semibold"
                disabled={busy}
                onClick={handleConfirm}
              >
                Confirm & Merge
              </button>
              <button
                type="button"
                className="focus-ring w-full rounded-2xl border border-[var(--paper-border)] px-4 py-2 text-sm"
                disabled={busy}
                onClick={() => setPreview(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-4 flex gap-4 border-b border-[var(--paper-border)] pb-2 text-sm font-semibold">
              <button
                type="button"
                className={`px-2 ${tab === 'scan' ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]' : 'opacity-60'}`}
                onClick={() => setTab('scan')}
              >
                Camera Scanner
              </button>
              <button
                type="button"
                className={`px-2 ${tab === 'paste' ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]' : 'opacity-60'}`}
                onClick={() => setTab('paste')}
              >
                Enter Code
              </button>
            </div>

            <div className="mt-4 min-h-[250px]">
              {tab === 'scan' ? (
                <div className="overflow-hidden rounded-2xl">
                  <Scanner
                    onScan={(result: any) => {
                      if (result && result.length > 0) {
                        void handleCode(result[0].rawValue)
                      }
                    }}
                    formats={['qr_code']}
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <textarea
                    className="focus-ring h-32 w-full rounded-2xl border border-[var(--paper-border)] bg-transparent p-3 text-sm font-mono"
                    placeholder="Paste raw crypto code..."
                    value={pastedCode}
                    onChange={(e) => setPastedCode(e.target.value)}
                  />
                  <button
                    type="button"
                    className="focus-ring rounded-2xl border border-[var(--paper-border)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
                    disabled={!pastedCode.trim() || busy}
                    onClick={() => void handleCode(pastedCode)}
                  >
                    {busy ? 'Decrypting...' : 'Decrypt Code'}
                  </button>
                </div>
              )}
              {error && <div className="mt-4 text-sm" style={{ color: 'var(--danger)' }}>{error}</div>}
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                className="focus-ring rounded-xl px-4 py-2 text-sm"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

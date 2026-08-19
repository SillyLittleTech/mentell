import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Link, useLocation } from 'react-router-dom'
import {
  decryptOfflineSyncPayload,
  isOfflineSyncData,
  isShareDashboardPayload,
  type OfflineSyncPayload,
} from '../sync/cryptSync'
import { cryptCodeFromLocation, parseCryptCode } from '../sync/cryptCode'
import { CryptCodeEntry } from '../sync/CryptCodeEntry'
import { OfflineSyncImportConfirm } from '../sync/OfflineSyncImportConfirm'
import { mergeOfflineSyncData, replaceOfflineSyncData } from '../sync/syncMerge'
import { SharePayloadView } from './SharePayloadView'

export function CryptSharePage() {
  const location = useLocation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [envelope, setEnvelope] = useState<OfflineSyncPayload | null>(null)
  const [importBusy, setImportBusy] = useState(false)
  const [imported, setImported] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadFromLocation() {
      const code = cryptCodeFromLocation({
        href: typeof window !== 'undefined' ? window.location.href : '',
        search: location.search,
        hash: location.hash,
      })
      if (!code) return
      setBusy(true)
      setError(null)
      try {
        const next = await decryptFromCode(code)
        if (active) setEnvelope(next)
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Could not decrypt this share.')
      } finally {
        if (active) setBusy(false)
      }
    }

    void loadFromLocation()
    return () => {
      active = false
    }
  }, [location.hash, location.search])

  async function handleCode(code: string) {
    setBusy(true)
    setError(null)
    setImported(null)
    try {
      setEnvelope(await decryptFromCode(code))
    } catch (e) {
      setEnvelope(null)
      setError(e instanceof Error ? e.message : 'Could not decrypt this share.')
    } finally {
      setBusy(false)
    }
  }

  async function handleImport(payload: OfflineSyncPayload, mode: 'merge' | 'replace') {
    if (!isOfflineSyncData(payload.data)) return
    setImportBusy(true)
    setError(null)
    try {
      if (mode === 'replace') await replaceOfflineSyncData(payload.data)
      else await mergeOfflineSyncData(payload.data)
      setImported(
        mode === 'replace'
          ? 'This device now matches the snapshot.'
          : 'Snapshot merged into this device.',
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : mode === 'replace' ? 'Replace failed' : 'Merge failed')
    } finally {
      setImportBusy(false)
    }
  }

  if (envelope && isShareDashboardPayload(envelope.data)) {
    return (
      <div className="desk min-h-[100svh] px-4 py-8">
        <div className="mx-auto max-w-2xl space-y-4">
          <header className="paper rounded-3xl p-6 text-center">
            <div className="font-paper text-2xl">Mentell shared view</div>
            <div className="ink-muted mt-2 text-sm">
              Shared by {envelope.sender.displayName || 'Unknown'}
              {envelope.sender.identifier ? ` (${envelope.sender.identifier})` : ''}
            </div>
            <div className="ink-muted mt-2 text-xs">
              Shared on {format(envelope.createdAt, 'PPp')}
              {envelope.expiresAt ? ` | Valid until ${format(envelope.expiresAt, 'PPp')}` : ''}
            </div>
          </header>
          <SharePayloadView payload={envelope.data} />
          <footer className="ink-muted text-center text-xs">
            Decrypted only on this device. Not for emergency use. Not a clinical record.
          </footer>
        </div>
      </div>
    )
  }

  if (envelope && isOfflineSyncData(envelope.data)) {
    const entryCount = envelope.data.entries.length
    return (
      <div className="desk flex min-h-[100svh] items-center justify-center p-6">
        <div className="paper w-full max-w-md rounded-3xl p-6">
          <div className="font-paper text-2xl">Import device sync?</div>
          <p className="ink-muted mt-2 text-sm">
            This code is a full journal snapshot, not a share link.
          </p>
          <OfflineSyncImportConfirm
            payload={envelope}
            entryCount={entryCount}
            busy={importBusy}
            error={error}
            doneLabel={imported}
            onMerge={() => void handleImport(envelope, 'merge')}
            onReplace={() => void handleImport(envelope, 'replace')}
            onCancel={() => setEnvelope(null)}
          />
          <Link
            to="/"
            className="focus-ring mt-3 inline-flex rounded-2xl border border-[var(--paper-border)] px-4 py-2 text-sm"
          >
            Return to Mentell
          </Link>
        </div>
      </div>
    )
  }

  const expiredError = error?.toLowerCase().includes('expired')

  if (expiredError) {
    return <ExpiredNotice message={error ?? 'This encrypted share has expired.'} />
  }

  return (
    <div className="desk flex min-h-[100svh] items-center justify-center p-6">
      <div className="paper w-full max-w-md rounded-3xl p-6">
        <div className="font-paper text-2xl">Encrypted share</div>
        <p className="ink-muted mt-2 text-sm">
          Scan a QR code or paste a crypto code. Nothing is sent to a server.
        </p>
        {busy && !envelope ? (
          <div className="ink-muted mt-4 font-mono text-sm">Decrypting…</div>
        ) : (
          <CryptCodeEntry busy={busy} error={error} onCode={(code) => void handleCode(code)} />
        )}
        <Link
          to="/"
          className="focus-ring mt-4 inline-flex rounded-2xl border border-[var(--paper-border)] px-4 py-2 text-sm"
        >
          Return to Mentell
        </Link>
      </div>
    </div>
  )
}

function ExpiredNotice({ message }: { message: string }) {
  return (
    <div className="desk flex min-h-[100svh] items-center justify-center p-6">
      <div className="paper max-w-md rounded-3xl p-6 text-center">
        <div className="font-paper text-xl">Expired link</div>
        <p className="ink-muted mt-2 text-sm">{message}</p>
        <Link
          to="/"
          className="focus-ring mt-4 inline-flex rounded-2xl border border-[var(--paper-border)] px-4 py-2 text-sm font-semibold"
        >
          Return to Mentell
        </Link>
      </div>
    </div>
  )
}

async function decryptFromCode(code: string): Promise<OfflineSyncPayload> {
  const { payloadBase64Url, keyBase64Url } = parseCryptCode(code)
  return decryptOfflineSyncPayload(payloadBase64Url, keyBase64Url)
}

import { useState } from 'react'
import { MaterialIcon } from '../../components/MaterialIcon'
import { SyncDownModal } from './SyncDownModal'
import { SyncUpModal } from './SyncUpModal'

export function OfflineDeviceSyncSection({ compact = false }: { compact?: boolean }) {
  const [downOpen, setDownOpen] = useState(false)
  const [upOpen, setUpOpen] = useState(false)

  const buttons = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="focus-ring rounded-2xl border border-[var(--paper-border)] px-4 py-2 text-sm font-semibold"
        onClick={() => setDownOpen(true)}
      >
        <span className="inline-flex items-center gap-2">
          <MaterialIcon name="qr_code_2" size={20} accent={false} className="text-[var(--paper-ink)] opacity-85" />
          Sync down (export QR)
        </span>
      </button>
      <button
        type="button"
        className="focus-ring rounded-2xl border border-[var(--paper-border)] px-4 py-2 text-sm font-semibold"
        onClick={() => setUpOpen(true)}
      >
        <span className="inline-flex items-center gap-2">
          <MaterialIcon name="qr_code_scanner" size={20} accent={false} className="text-[var(--paper-ink)] opacity-85" />
          Sync up (scan / import)
        </span>
      </button>
    </div>
  )

  return (
    <>
      {compact ? (
        <section className="paper rounded-3xl p-6">
          <div className="font-paper text-xl">Offline device sync</div>
          <p className="ink-muted mt-1 text-sm">
            Copy this journal to another device with a QR code or crypto code. Does not use cloud
            backup.
          </p>
          <div className="mt-4">{buttons}</div>
        </section>
      ) : (
        <section id="offline-device-sync" className="paper rounded-3xl p-6">
          <div className="font-paper text-xl">Offline device sync</div>
          <p className="ink-muted mt-1 text-sm">
            Export or import a local snapshot with an encrypted QR code or crypto code. Works with
            or without cloud backup, including debug builds.
          </p>
          <div className="mt-4">{buttons}</div>
        </section>
      )}
      <SyncDownModal open={downOpen} onClose={() => setDownOpen(false)} />
      <SyncUpModal open={upOpen} onClose={() => setUpOpen(false)} />
    </>
  )
}

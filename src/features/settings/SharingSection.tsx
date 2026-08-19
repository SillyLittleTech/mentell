import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { isShareLinksEnabled } from '../../shared/features/featureFlags'
import { useAuthOptional } from '../../shared/firebase/AuthProvider'
import { useToast } from '../../shared/ui/useToast'
import {
  createShareLink,
  listShareLinks,
  renewShareLink,
  revokeShareLink,
  type ShareLinkRecord,
} from '../share/shareCodeService'
import {
  durationToMs,
  SHARE_PRESETS,
  type SharePermissions,
  type SharePreset,
} from '../share/shareTypes'
import { buildSharePayload } from '../share/sharePayloadBuilder'
import { createOfflineSyncPayload, type OfflineSyncPayload } from '../sync/cryptSync'
import {
  buildCryptShareUrl,
  canEncodeQrValue,
  encodeCryptCode,
} from '../sync/cryptCode'
import { CryptQrBlock } from '../sync/CryptQrBlock'
import { getEffectiveGlobalName } from '../../shared/settings/effectiveGlobalName'

const DURATIONS = [
  { label: '24 hours', hours: 24 },
  { label: '7 days', hours: 24 * 7 },
  { label: '30 days', hours: 24 * 30 },
] as const

const TOAST_TIMEOUT_MS = 2000

function presetDataWindowLabel(preset: SharePreset) {
  const days = SHARE_PRESETS[preset].maxDays
  return `Includes entries from the last ${days} days (${preset} preset).`
}

function currentTimestamp() {
  return Date.now()
}

export function SharingPanel() {
  const cloudSharing = isShareLinksEnabled()
  const auth = useAuthOptional()
  const [links, setLinks] = useState<ShareLinkRecord[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { showToast: _showToast } = useToast()
  const [preset, setPreset] = useState<SharePreset>('family')

  function showToast(message: string, durationMs = TOAST_TIMEOUT_MS) {
    _showToast({ message, duration: durationMs > 0 ? durationMs : undefined, isSticky: durationMs === 0 })
  }

  const [label, setLabel] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [hours, setHours] = useState(24 * 7)
  const [persistentShare, setPersistentShare] = useState(false)
  const [offlineCrypt, setOfflineCrypt] = useState(!cloudSharing)
  const [viewerCode, setViewerCode] = useState('')
  const [permissions, setPermissions] = useState<SharePermissions>(SHARE_PRESETS.family)
  const [lastCreatedUrl, setLastCreatedUrl] = useState<string | null>(null)
  const [lastCreatedCode, setLastCreatedCode] = useState<string | null>(null)
  const [now, setNow] = useState(() => currentTimestamp())
  const uid = auth?.user?.uid
  const canCreateOnline = cloudSharing && Boolean(uid) && Boolean(auth?.syncEnabled)
  const useCrypt = offlineCrypt || !canCreateOnline

  async function refreshLinks() {
    if (!uid) return
    const rows = await listShareLinks(uid)
    setLinks(rows)
    setNow(currentTimestamp())
  }

  useEffect(() => {
    if (!uid || !cloudSharing) return
    let active = true
    void listShareLinks(uid).then((rows) => {
      if (!active) return
      setLinks(rows)
      setNow(currentTimestamp())
    })
    return () => {
      active = false
    }
  }, [uid, cloudSharing])

  async function handleCreate() {
    if (!useCrypt && (!uid || !auth?.syncEnabled)) {
      setError('Must be signed in with sync enabled to create online share links.')
      return
    }
    setBusy(true)
    setError(null)
    setLastCreatedUrl(null)
    setLastCreatedCode(null)
    try {
      if (useCrypt) {
        const sharePayload = await buildSharePayload(permissions)
        const envelope: OfflineSyncPayload = {
          version: 1,
          createdAt: currentTimestamp(),
          expiresAt: currentTimestamp() + durationToMs(hours),
          sender: {
            displayName: displayName.trim() || getEffectiveGlobalName() || null,
            identifier: auth?.user?.email ?? null,
          },
          data: sharePayload,
        }
        const { payloadBase64Url, keyBase64Url } = await createOfflineSyncPayload(envelope)
        setLastCreatedUrl(buildCryptShareUrl(payloadBase64Url, keyBase64Url))
        setLastCreatedCode(encodeCryptCode(payloadBase64Url, keyBase64Url))
        return
      }

      const record = await createShareLink({
        uid: uid || '',
        preset,
        permissions,
        label: label.trim() || 'Shared view',
        ownerDisplayName: displayName.trim(),
        expiresAt: currentTimestamp() + durationToMs(hours),
        mode: persistentShare ? 'protected' : 'snapshot',
        viewerCode: persistentShare ? viewerCode.trim() : undefined,
      })
      setLastCreatedUrl(record.shareUrl)
      await refreshLinks()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create link')
    } finally {
      setBusy(false)
    }
  }

  async function handleRenew(code: string) {
    if (!uid) return
    setBusy(true)
    setError(null)
    try {
      await renewShareLink(uid, code)
      showToast('Link renewed')
      await refreshLinks()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not renew link')
    } finally {
      setBusy(false)
    }
  }

  async function copyText(text: string, message = 'Link copied') {
    try {
      await navigator.clipboard.writeText(text)
      showToast(message)
    } catch {
      showToast('Copy failed - select the text manually', 0)
    }
  }

  async function shareUrl(url: string) {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Mentell shared view', url })
        return
      } catch {
        /* user cancelled */
      }
    }
    await copyText(url)
  }

  const qrValue =
    lastCreatedCode && canEncodeQrValue(lastCreatedUrl ?? '')
      ? lastCreatedUrl
      : lastCreatedCode && canEncodeQrValue(lastCreatedCode)
        ? lastCreatedCode
        : lastCreatedUrl && canEncodeQrValue(lastCreatedUrl)
          ? lastCreatedUrl
          : lastCreatedCode

  return (
    <section className="paper rounded-3xl p-6">
      <div className="font-paper text-xl">Sharing</div>
      <div className="ink-muted mt-1 text-sm">
        {useCrypt
          ? 'Create an encrypted snapshot as a QR code or link. Nothing is stored on a server.'
          : 'Share links for family, friends, or professionals. Snapshot links expire on schedule; protected links keep the same slug and ask viewers for a code.'}
      </div>

      <div className="mt-4 grid gap-3">
        <label className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--paper-border)] px-3 py-3 text-sm">
          <span>
            Offline / Crypt share (zero-knowledge)
            <div className="ink-muted text-xs">
              Generates an encrypted link/QR without saving any data on the server.
            </div>
          </span>
          <input
            type="checkbox"
            checked={useCrypt}
            disabled={!canCreateOnline}
            onChange={(e) => {
              setOfflineCrypt(e.target.checked)
              if (e.target.checked) setPersistentShare(false)
            }}
          />
        </label>
        {!canCreateOnline ? (
          <p className="ink-muted text-xs">
            {cloudSharing
              ? 'Sign in under Settings → Account with cloud sync on to create hosted share links. Offline crypt sharing still works here.'
              : 'Hosted share links are off. Offline crypt sharing still works on this device.'}
          </p>
        ) : null}

        {!useCrypt ? (
          <label className="grid gap-1 text-sm">
            <span className="ink-muted">Label (private)</span>
            <input
              className="focus-ring rounded-2xl border border-[var(--paper-border)] bg-transparent px-3 py-2"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="For Dr. Lee"
            />
          </label>
        ) : null}
        <label className="grid gap-1 text-sm">
          <span className="ink-muted">Display name (shown to viewers)</span>
          <input
            className="focus-ring rounded-2xl border border-[var(--paper-border)] bg-transparent px-3 py-2"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Optional first name"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="ink-muted">Preset</span>
          <select
            className="focus-ring rounded-2xl border border-[var(--paper-border)] bg-transparent px-3 py-2"
            value={preset}
            onChange={(e) => {
              const nextPreset = e.target.value as SharePreset
              setPreset(nextPreset)
              if (nextPreset !== 'custom') {
                setPermissions({ ...SHARE_PRESETS[nextPreset] })
              }
            }}
          >
            <option value="family">Family</option>
            <option value="friend">Friend</option>
            <option value="professional">Professional</option>
            <option value="custom">Custom</option>
          </select>
          <span className="ink-muted text-xs">{presetDataWindowLabel(preset)}</span>
        </label>

        {!useCrypt ? (
          <label className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--paper-border)] px-3 py-3 text-sm">
            <span>
              Permanent protected link
              <div className="ink-muted text-xs">
                Uses /share/&lt;your id&gt; and requires a viewer code.
              </div>
            </span>
            <input
              type="checkbox"
              checked={persistentShare}
              onChange={(e) => setPersistentShare(e.target.checked)}
            />
          </label>
        ) : null}

        {persistentShare && !useCrypt ? (
          <label className="grid gap-1 text-sm">
            <span className="ink-muted">Viewer code</span>
            <input
              className="focus-ring rounded-2xl border border-[var(--paper-border)] bg-transparent px-3 py-2"
              value={viewerCode}
              onChange={(e) => setViewerCode(e.target.value)}
              placeholder="Email, name, or passcode"
            />
            <span className="ink-muted text-xs">
              The viewer enters this code on the public share page to unlock the data.
            </span>
          </label>
        ) : null}

        <label className="grid gap-1 text-sm">
          <span className="ink-muted">
            {persistentShare && !useCrypt ? 'Renew every' : 'Link expires in'}
          </span>
          <select
            className="focus-ring rounded-2xl border border-[var(--paper-border)] bg-transparent px-3 py-2"
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
          >
            {DURATIONS.map((d) => (
              <option key={d.hours} value={d.hours}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {preset === 'custom' ? (
        <div className="mt-4 grid gap-2 text-sm">
          <PermToggle
            label="Situation lines"
            checked={permissions.showSituation}
            onChange={(v) => setPermissions((p) => ({ ...p, showSituation: v }))}
          />
          <PermToggle
            label="Full details"
            checked={permissions.showDetails}
            onChange={(v) => setPermissions((p) => ({ ...p, showDetails: v }))}
          />
          <PermToggle
            label="Streak"
            checked={permissions.showStreak}
            onChange={(v) => setPermissions((p) => ({ ...p, showStreak: v }))}
          />
          <PermToggle
            label="Sentiment breakdown"
            checked={permissions.showSentimentBreakdown}
            onChange={(v) => setPermissions((p) => ({ ...p, showSentimentBreakdown: v }))}
          />
        </div>
      ) : null}

      <button
        type="button"
        disabled={busy || (!useCrypt && persistentShare && !viewerCode.trim())}
        className="focus-ring mt-4 w-full rounded-2xl border border-[var(--paper-border)] bg-[rgba(42,155,88,0.12)] px-4 py-2 text-sm font-semibold disabled:opacity-60"
        onClick={() => void handleCreate()}
      >
        {useCrypt
          ? 'Create encrypted share'
          : persistentShare
            ? 'Create protected share link'
            : 'Create share link'}
      </button>

      {lastCreatedUrl || lastCreatedCode ? (
        <div className="mt-4 rounded-2xl border border-[var(--paper-border)] p-3">
          <div className="ink-muted text-xs">{useCrypt ? 'Encrypted share' : 'New link'}</div>
          {qrValue ? (
            <div className="mt-3 flex justify-center">
              <CryptQrBlock value={qrValue} />
            </div>
          ) : null}
          {lastCreatedUrl ? (
            <input
              readOnly
              className="mt-3 w-full rounded-xl border border-[var(--paper-border)] bg-transparent px-2 py-2 font-mono text-xs"
              value={lastCreatedUrl}
            />
          ) : null}
          {persistentShare && !useCrypt ? (
            <div className="ink-muted mt-2 text-xs">
              Keep the viewer code private. The URL stays the same until you revoke it or renew it.
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {lastCreatedUrl ? (
              <button
                type="button"
                className="focus-ring rounded-xl border border-[var(--paper-border)] px-3 py-1.5 text-xs font-semibold"
                onClick={() => void copyText(lastCreatedUrl)}
              >
                Copy link
              </button>
            ) : null}
            {lastCreatedCode ? (
              <button
                type="button"
                className="focus-ring rounded-xl border border-[var(--paper-border)] px-3 py-1.5 text-xs"
                onClick={() => void copyText(lastCreatedCode, 'Crypto code copied')}
              >
                Copy crypto code
              </button>
            ) : null}
            {lastCreatedUrl && 'share' in navigator ? (
              <button
                type="button"
                className="focus-ring rounded-xl border border-[var(--paper-border)] px-3 py-1.5 text-xs"
                onClick={() => void shareUrl(lastCreatedUrl)}
              >
                Share...
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 text-sm" style={{ color: 'var(--danger)' }}>
          {error}
        </div>
      ) : null}

      {!useCrypt && links.length > 0 ? (
        <div className="mt-6 space-y-2">
          <div className="font-mono text-xs font-bold uppercase opacity-70">Active links</div>
          {links.map((l) => {
            const isExpired = l.expiresAt <= now
            return (
              <div
                key={l.code}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-medium">{l.label}</div>
                  <div className="ink-muted text-xs">
                    {l.mode === 'protected' ? 'Renew by' : 'Expires'} {format(l.expiresAt, 'PPp')}{' '}
                    - {l.preset}
                    {l.mode === 'protected' && isExpired ? ' - renewal required' : ''}
                  </div>
                </div>
                <div className="flex gap-2">
                  {l.mode === 'protected' ? (
                    <button
                      type="button"
                      className="focus-ring rounded-xl border border-[var(--paper-border)] px-2 py-1 text-xs"
                      disabled={busy}
                      onClick={() => void handleRenew(l.code)}
                    >
                      Renew
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="focus-ring rounded-xl border border-[var(--paper-border)] px-2 py-1 text-xs"
                    onClick={() => void copyText(l.shareUrl)}
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    className="focus-ring rounded-xl border border-[var(--paper-border)] px-2 py-1 text-xs"
                    onClick={() => void revokeShareLink(uid!, l.code).then(refreshLinks)}
                  >
                    Revoke
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}

      <p className="ink-muted mt-4 text-xs">
        Treat links like passwords. Revoke when done. Not for emergency services.
      </p>
    </section>
  )
}

function PermToggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

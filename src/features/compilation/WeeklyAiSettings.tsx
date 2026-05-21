import { useEffect, useState } from 'react'
import {
  loadAiProfile,
  saveAiProfile,
  type AiAgeRange,
  type AiProfile,
} from './aiProfile'
import { publicUrl } from '../../shared/publicUrl'

const AGE_OPTIONS: { value: AiAgeRange; label: string }[] = [
  { value: 'prefer-not', label: 'Prefer not to say' },
  { value: 'under18', label: 'Under 18' },
  { value: '18-24', label: '18–24' },
  { value: '25-34', label: '25–34' },
  { value: '35-44', label: '35–44' },
  { value: '45-54', label: '45–54' },
  { value: '55+', label: '55+' },
]

const ABOUT_MAX = 500

export function WeeklyAiSettings({
  open,
  onClose,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  onSaved: (profile: AiProfile) => void
}) {
  const [draft, setDraft] = useState<AiProfile>(() => loadAiProfile())

  useEffect(() => {
    if (open) setDraft(loadAiProfile())
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-6"
      onClick={onClose}
    >
      <div
        className="paper w-full max-w-lg rounded-3xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-paper text-2xl">AI preferences</div>
            <div className="ink-muted mt-1 text-sm">
              Stored only on this device. Sent to your Worker when you generate a summary.
            </div>
          </div>
          <button
            type="button"
            className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-sm"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <label className="grid gap-2">
            <span className="ink-muted text-sm font-medium">Display name (optional)</span>
            <input
              type="text"
              className="focus-ring rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3"
              placeholder="e.g. Kiya"
              maxLength={40}
              value={draft.displayName}
              onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))}
            />
          </label>

          <label className="grid gap-2">
            <span className="ink-muted text-sm font-medium">Age range (optional)</span>
            <select
              className="focus-ring rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3"
              value={draft.ageRange || 'prefer-not'}
              onChange={(e) =>
                setDraft((d) => ({ ...d, ageRange: e.target.value as AiAgeRange }))
              }
            >
              {AGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="ink-muted text-sm font-medium">
              What should they know about me?
            </span>
            <textarea
              className="focus-ring min-h-[120px] rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3"
              placeholder="Tone, context, things to keep in mind…"
              maxLength={ABOUT_MAX}
              value={draft.about}
              onChange={(e) => setDraft((d) => ({ ...d, about: e.target.value }))}
            />
            <div className="ink-muted text-xs">
              {draft.about.length}/{ABOUT_MAX} · Used for tone and style (e.g. “be playful”, “keep it brief”).
              Regenerate your summary after saving. Not medical advice.
            </div>
          </label>
        </div>

        <button
          type="button"
          className="focus-ring mt-5 w-full rounded-2xl px-4 py-3 text-sm font-semibold"
          style={{ background: 'var(--warn)', color: 'rgba(0,0,0,0.85)' }}
          onClick={() => {
            const saved = saveAiProfile(draft)
            onSaved(saved)
            onClose()
          }}
        >
          Save preferences
        </button>
      </div>
    </div>
  )
}

export function WeeklyAiSettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="focus-ring rounded-2xl border border-[var(--paper-border)] p-2"
      aria-label="AI preferences"
      title="AI preferences"
      onClick={onClick}
    >
      <img
        alt=""
        src={publicUrl('/asset/setting.png')}
        className="h-8 w-8 select-none object-contain"
        draggable={false}
      />
    </button>
  )
}

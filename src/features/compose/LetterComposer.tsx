import React, { useMemo, useState } from 'react'
import { ProgressLight, type ProgressState } from '../../components/ProgressLight'
import { SentimentPills, type SentimentValue } from '../../components/SentimentPills'
import { dateKeyForLocalDay } from '../../shared/dates'
import { flagConcerningLanguage } from '../safety/flagTerms'
import type { EntryEmotion } from '../../db/schema'

type Draft = {
  dateKey: string
  sentiment: SentimentValue
  emotion: EntryEmotion
  emotionNote: string
  situation: string
  details: string
  flaggedTerms: string[]
  warningLevel: 'none' | 'warn'
}

const EMOTION_OPTIONS: Array<{ value: EntryEmotion; label: string }> = [
  { value: 'happy', label: '🙂 Happy' },
  { value: 'calm', label: '😌 Calm' },
  { value: 'anxious', label: '😟 Anxious' },
  { value: 'sad', label: '😔 Sad' },
  { value: 'angry', label: '😠 Angry' },
  { value: 'other', label: '🤔 None of these fit' },
]

export function LetterComposer({
  onSubmit,
}: {
  onSubmit: (draft: Draft) => Promise<void> | void
}) {
  const [step, setStep] = useState<'write' | 'review'>('write')
  const [sentiment, setSentiment] = useState<SentimentValue>('+')
  const [emotion, setEmotion] = useState<EntryEmotion>('happy')
  const [emotionNote, setEmotionNote] = useState('')
  const [situation, setSituation] = useState('')
  const [details, setDetails] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitState, setSubmitState] = useState<'idle' | 'done' | 'error'>('idle')
  const dateKey = useMemo(() => dateKeyForLocalDay(new Date()), [])

  const flag = useMemo(() => flagConcerningLanguage(`${situation}\n${details}`), [details, situation])

  const progressState: ProgressState =
    flag.warningLevel === 'warn' ? 'warn' : step === 'review' ? 'review' : 'write'

  async function handleSubmit() {
    if (isSubmitting) return
    setIsSubmitting(true)
    setSubmitState('idle')
    try {
      await onSubmit({
        dateKey,
        sentiment,
        emotion,
        emotionNote: emotion === 'other' ? emotionNote.trim() : '',
        situation: situation.trim(),
        details: details.trim(),
        flaggedTerms: flag.flaggedTerms,
        warningLevel: flag.warningLevel,
      })

      // Clear inputs after successful submit to make completion obvious.
      setStep('write')
      setSentiment('+')
      setEmotion('happy')
      setEmotionNote('')
      setSituation('')
      setDetails('')
      setSubmitState('done')
      window.setTimeout(() => setSubmitState('idle'), 2200)
    } catch {
      setSubmitState('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <ProgressLight state={progressState} />

      <section className="paper rounded-3xl p-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="font-paper text-2xl">Today’s letter</div>
            <div className="ink-muted mt-1 text-sm">Date: {dateKey}</div>
          </div>
          <SentimentPills value={sentiment} onChange={setSentiment} />
        </header>

        <div className="mt-6 grid gap-5">
          <Field label="Situation">
            <input
              className="focus-ring w-full rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3 font-paper text-lg"
              value={situation}
              onChange={(e) => setSituation(e.target.value)}
              placeholder="What happened?"
            />
          </Field>

          <Field label="Details">
            <textarea
              className="focus-ring min-h-[180px] w-full resize-y rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3 font-paper text-lg leading-relaxed"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Write it like a letter you’re drafting…"
            />
          </Field>

          <Field label="Emotion check‑in">
            <div className="grid gap-3">
              <select
                className="focus-ring w-full rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3 text-sm"
                value={emotion}
                onChange={(e) => setEmotion(e.target.value as EntryEmotion)}
              >
                {EMOTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {emotion === 'other' ? (
                <input
                  className="focus-ring w-full rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3 font-paper text-lg"
                  value={emotionNote}
                  onChange={(e) => setEmotionNote(e.target.value)}
                  placeholder="What emotion would you call this?"
                />
              ) : null}
            </div>
          </Field>
        </div>

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="ink-muted text-sm">
            {submitState === 'done' ? (
              <div className="font-medium" style={{ color: 'var(--success)' }}>
                Submitted and cleared. Ready for your next entry.
              </div>
            ) : submitState === 'error' ? (
              <div className="font-medium" style={{ color: 'var(--danger)' }}>
                Submit failed. Please try again.
              </div>
            ) : flag.warningLevel === 'warn' ? (
              <div className="space-y-1">
                <div className="font-medium" style={{ color: 'var(--danger)' }}>
                  I noticed some heavy words — please take care.
                </div>
                <div>Flagged: {flag.flaggedTerms.join(', ')}</div>
              </div>
            ) : step === 'write' ? (
              'When you’re ready, review it like a sealed note.'
            ) : (
              'Looks good? Submit when you’re ready.'
            )}
          </div>

          <div className="flex items-center gap-2">
            {step === 'review' ? (
              <button
                type="button"
                className="focus-ring rounded-2xl border border-[var(--paper-border)] px-4 py-3 text-sm font-medium"
                onClick={() => setStep('write')}
              >
                Back to writing
              </button>
            ) : null}

            {step === 'write' ? (
              <button
                type="button"
                className="focus-ring rounded-2xl px-4 py-3 text-sm font-medium"
                style={{ background: 'var(--warn)', color: 'rgba(0,0,0,0.85)' }}
                onClick={() => setStep('review')}
              >
                Review
              </button>
            ) : (
              <button
                type="button"
                className="focus-ring rounded-2xl px-4 py-3 text-sm font-medium"
                style={{ background: 'var(--success)', color: 'rgba(0,0,0,0.92)' }}
                disabled={isSubmitting}
                onClick={handleSubmit}
              >
                {isSubmitting ? 'Submitting…' : 'Submit'}
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2">
      <div className="ink-muted text-sm font-medium">{label}</div>
      {children}
    </label>
  )
}


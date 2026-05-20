import React, { useMemo, useState } from 'react'
import { ProgressLight, type ProgressState } from '../../components/ProgressLight'
import { SentimentPills, type SentimentValue } from '../../components/SentimentPills'
import { dateKeyForLocalDay } from '../../shared/dates'
import { flagConcerningLanguage } from '../safety/flagTerms'

type Draft = {
  dateKey: string
  sentiment: SentimentValue
  situation: string
  details: string
  flaggedTerms: string[]
  warningLevel: 'none' | 'warn'
}

export function LetterComposer({
  onSubmit,
}: {
  onSubmit: (draft: Draft) => Promise<void> | void
}) {
  const [step, setStep] = useState<'write' | 'review'>('write')
  const [sentiment, setSentiment] = useState<SentimentValue>('+')
  const [situation, setSituation] = useState('')
  const [details, setDetails] = useState('')
  const dateKey = useMemo(() => dateKeyForLocalDay(new Date()), [])

  const flag = useMemo(() => flagConcerningLanguage(`${situation}\n${details}`), [details, situation])

  const progressState: ProgressState =
    flag.warningLevel === 'warn' ? 'warn' : step === 'review' ? 'review' : 'write'

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
        </div>

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="ink-muted text-sm">
            {flag.warningLevel === 'warn' ? (
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
                onClick={() =>
                  onSubmit({
                    dateKey,
                    sentiment,
                    situation: situation.trim(),
                    details: details.trim(),
                    flaggedTerms: flag.flaggedTerms,
                    warningLevel: flag.warningLevel,
                  })
                }
              >
                Submit
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


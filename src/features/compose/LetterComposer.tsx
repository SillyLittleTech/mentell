import React, { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ProgressLight, type ProgressState } from '../../components/ProgressLight'
import { SentimentPills, type SentimentValue } from '../../components/SentimentPills'
import { dateKeyForLocalDay } from '../../shared/dates'
import { isDebugMode } from '../../shared/debug/debugFlags'
import { motionDuration, shouldReduceMotion } from '../../shared/motion/useMotionPrefs'
import { assessLocalRisk, assessRisk, type RiskAssessment } from '../safety/riskAssessment'
import { CrisisResourcePanel } from '../safety/CrisisResourcePanel'
import type { EntryEmotion, RiskLevel } from '../../db/schema'

type Draft = {
  dateKey: string
  sentiment: SentimentValue
  emotion: EntryEmotion
  emotionNote: string
  situation: string
  details: string
  flaggedTerms: string[]
  warningLevel: 'none' | 'warn'
  riskScore: number
  interventionScore: number
  riskLevel: RiskLevel
}

const EMOTION_OPTIONS: Array<{ value: EntryEmotion; label: string }> = [
  { value: 'happy', label: '🙂 Happy' },
  { value: 'calm', label: '😌 Calm' },
  { value: 'anxious', label: '😟 Anxious' },
  { value: 'sad', label: '😔 Sad' },
  { value: 'angry', label: '😠 Angry' },
  { value: 'other', label: '🤔 None of these fit' },
]

type DebugAiTestFill = {
  sentiment: SentimentValue
  emotion: EntryEmotion
  emotionNote: string
  situation: string
  details: string
}

export function LetterComposer({
  onSubmit,
  disabled = false,
}: {
  onSubmit: (draft: Draft) => Promise<void> | void
  disabled?: boolean
}) {
  const [step, setStep] = useState<'write' | 'review'>('write')
  const [sentiment, setSentiment] = useState<SentimentValue>('+')
  const [emotion, setEmotion] = useState<EntryEmotion>('happy')
  const [emotionNote, setEmotionNote] = useState('')
  const [situation, setSituation] = useState('')
  const [details, setDetails] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitState, setSubmitState] = useState<'idle' | 'done' | 'error'>('idle')
  const [draftRisk, setDraftRisk] = useState<RiskAssessment | null>(null)
  const [submittedRisk, setSubmittedRisk] = useState<RiskAssessment | null>(null)
  const [dateKey, setDateKey] = useState(() => dateKeyForLocalDay(new Date()))

  useEffect(() => {
    const refreshDateKey = () => setDateKey(dateKeyForLocalDay(new Date()))
    const intervalId = window.setInterval(refreshDateKey, 60_000)
    window.addEventListener('focus', refreshDateKey)
    document.addEventListener('visibilitychange', refreshDateKey)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshDateKey)
      document.removeEventListener('visibilitychange', refreshDateKey)
    }
  }, [])

  useEffect(() => {
    if (!isDebugMode()) return
    const fillDebugAiTest = (event: Event) => {
      const detail = (event as CustomEvent<DebugAiTestFill>).detail
      if (!detail) return
      setStep('write')
      setSentiment(detail.sentiment)
      setEmotion(detail.emotion)
      setEmotionNote(detail.emotionNote)
      setSituation(detail.situation)
      setDetails(detail.details)
      setDraftRisk(null)
      setSubmitState('idle')
    }
    window.addEventListener('mentell:debug-ai-test-fill', fillDebugAiTest)
    return () => window.removeEventListener('mentell:debug-ai-test-fill', fillDebugAiTest)
  }, [])

  const riskInput = useMemo(
    () => ({
      dateKey,
      sentiment,
      emotion,
      emotionNote,
      situation,
      details,
    }),
    [dateKey, details, emotion, emotionNote, sentiment, situation],
  )

  useEffect(() => {
    let active = true
    const id = window.setTimeout(() => {
      void assessLocalRisk(riskInput).then((next) => {
        if (active) setDraftRisk(next)
      })
    }, 180)
    return () => {
      active = false
      window.clearTimeout(id)
    }
  }, [riskInput])

  const progressState: ProgressState =
    draftRisk?.warningLevel === 'warn' ? 'warn' : step === 'review' ? 'review' : 'write'

  async function handleSubmit() {
    if (disabled || isSubmitting) return
    setIsSubmitting(true)
    setSubmitState('idle')
    try {
      const finalRisk = await assessRisk(riskInput)
      await onSubmit({
        dateKey,
        sentiment,
        emotion,
        emotionNote: emotion === 'other' ? emotionNote.trim() : '',
        situation: situation.trim(),
        details: details.trim(),
        flaggedTerms: finalRisk.flaggedTerms,
        warningLevel: finalRisk.warningLevel,
        riskScore: finalRisk.riskScore,
        interventionScore: finalRisk.interventionScore,
        riskLevel: finalRisk.riskLevel,
      })

      // Clear inputs after successful submit to make completion obvious.
      setStep('write')
      setSentiment('+')
      setEmotion('happy')
      setEmotionNote('')
      setSituation('')
      setDetails('')
      setDraftRisk(null)
      setSubmitState('done')
      if (finalRisk.responseKind !== 'none') {
        setSubmittedRisk(finalRisk)
      }
      window.setTimeout(() => setSubmitState('idle'), 2200)
    } catch {
      setSubmitState('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className={`space-y-4 ${disabled ? 'pointer-events-none opacity-50' : ''}`}
      aria-disabled={disabled}
    >
      <ProgressLight state={progressState} />

      <section className="paper rounded-3xl p-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="font-paper text-2xl">Today’s letter</div>
            <div className="ink-muted mt-1 text-sm">Date: {dateKey}</div>
          </div>
          <SentimentPills value={sentiment} onChange={disabled ? () => {} : setSentiment} />
        </header>

        <div className="mt-6 grid gap-5">
          <Field label="Situation">
            <input
              disabled={disabled}
              className="focus-ring w-full rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3 font-paper text-lg"
              value={situation}
              onChange={(e) => setSituation(e.target.value)}
              placeholder="What happened?"
            />
          </Field>

          <Field label="Details">
            <textarea
              disabled={disabled}
              className="focus-ring min-h-[180px] w-full resize-y rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3 font-paper text-lg leading-relaxed"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Write it like a letter you’re drafting…"
            />
          </Field>

          <Field label="Emotion check‑in">
            <div className="grid gap-3">
              <select
                disabled={disabled}
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
                  disabled={disabled}
                  className="focus-ring w-full rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3 font-paper text-lg"
                  value={emotionNote}
                  onChange={(e) => setEmotionNote(e.target.value)}
                  placeholder="What emotion would you call this?"
                />
              ) : null}
            </div>
          </Field>
        </div>

        <footer className="mt-6 flex flex-wrap items-start justify-between gap-3">
          <div className="ink-muted min-w-0 flex-1 text-sm">
            {submitState === 'done' ? (
              <div className="font-medium" style={{ color: 'var(--success)' }}>
                Submitted and cleared. Ready for your next entry.
              </div>
            ) : submitState === 'error' ? (
              <div className="font-medium" style={{ color: 'var(--danger)' }}>
                Submit failed. Please try again.
              </div>
            ) : draftRisk?.warningLevel === 'warn' ? (
              <DraftRiskNotice risk={draftRisk} />
            ) : step === 'write' ? (
              'When you’re ready, review it like a sealed note.'
            ) : (
              'Looks good? Submit when you’re ready.'
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {step === 'review' ? (
              <button
                type="button"
                disabled={disabled}
                className="focus-ring rounded-2xl border border-[var(--paper-border)] px-4 py-3 text-sm font-medium"
                onClick={() => setStep('write')}
              >
                Back to writing
              </button>
            ) : null}

            {step === 'write' ? (
              <button
                type="button"
                disabled={disabled}
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
                disabled={disabled || isSubmitting}
                onClick={handleSubmit}
              >
                {isSubmitting ? 'Submitting…' : 'Submit'}
              </button>
            )}
          </div>
        </footer>
      </section>
      <AnimatePresence>
        {submittedRisk ? (
          <RiskResultModal risk={submittedRisk} onClose={() => setSubmittedRisk(null)} />
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function DraftRiskNotice({ risk }: { risk: RiskAssessment }) {
  return (
    <div className="space-y-1">
      <div className="font-medium" style={{ color: 'var(--danger)' }}>
        I noticed this feels heavy. You are cared about.
      </div>
      <div>
        When you submit, Mentell can show support resources or a gentler note for what you wrote.
      </div>
      <div className="font-mono text-[11px] uppercase opacity-70">
        Risk {risk.riskScore.toFixed(2)} · local
      </div>
    </div>
  )
}

function SupportNotice({ risk }: { risk: RiskAssessment }) {
  const celebration = risk.responseKind === 'positive'
  const message =
    risk.supportiveMessage ??
    (celebration
      ? 'That sounds like something worth noticing. Keep going.'
      : 'This sounds like a moment that deserves gentleness.')
  return (
    <div className="space-y-2">
      <div className="font-medium" style={{ color: 'var(--success)' }}>
        {celebration ? 'This deserves a little confetti' : 'A small note for this moment'}
      </div>
      <div>{message}</div>
      <div className="font-mono text-[11px] uppercase opacity-70">
        Intervention {risk.interventionScore.toFixed(1)} · {risk.source}
      </div>
    </div>
  )
}

function RiskNotice({ risk }: { risk: RiskAssessment }) {
  const crisis = risk.responseKind === 'crisis'
  return (
    <div className="space-y-2">
      <div className="font-medium" style={{ color: 'var(--danger)' }}>
        {crisis
          ? 'You matter, and you do not have to sit with this alone.'
          : 'I noticed this feels heavy. You are cared about.'}
      </div>
      <div>
        {risk.supportiveMessage ??
          (crisis
            ? 'If you might be in immediate danger, please contact emergency services, 988, or someone you trust now. Take one slow breath and stay near another person if you can. This moment can pass.'
            : 'Consider sharing these feelings with someone you trust or a mental health professional.')}
      </div>
      <div className="font-mono text-[11px] uppercase opacity-70">
        Intervention {risk.interventionScore.toFixed(1)} · {risk.source}
      </div>
      {risk.reasons.length ? <div>Signals: {risk.reasons.join(', ')}</div> : null}
      {crisis ? <CrisisResourcePanel compact /> : null}
    </div>
  )
}

function RiskResultModal({ risk, onClose }: { risk: RiskAssessment; onClose: () => void }) {
  const crisis = risk.responseKind === 'crisis'
  const support = risk.responseKind === 'support'
  const celebration = risk.responseKind === 'positive'
  const titleId = 'risk-result-modal-title'
  const reduced = shouldReduceMotion()
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduced ? undefined : { opacity: 0 }}
      transition={{ duration: motionDuration(0.2) || 0 }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="paper max-h-[min(90dvh,42rem)] w-full max-w-xl overflow-y-auto rounded-3xl p-6 shadow-lg"
        initial={reduced ? false : { scale: 0.96, y: 18 }}
        animate={{ scale: 1, y: 0 }}
        exit={reduced ? undefined : { scale: 0.98, y: 10 }}
        transition={{ duration: motionDuration(0.25) || 0 }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div id={titleId} className="font-paper text-2xl">
              {crisis ? 'You are not alone' : celebration ? 'Look at you go' : 'A note for you'}
            </div>
            <div className="ink-muted mt-1 text-sm">
              {crisis
                ? 'Mentell noticed this entry may need extra care.'
                : celebration
                  ? 'Mentell noticed a bright patch worth celebrating.'
                  : 'Mentell found a supportive note after reading your entry.'}
            </div>
          </div>
          <button
            type="button"
            className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-sm font-semibold"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="mt-5 rounded-2xl border border-[var(--paper-border)] p-4">
          {support || crisis ? <RiskNotice risk={risk} /> : <SupportNotice risk={risk} />}
        </div>
      </motion.div>
    </motion.div>
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

import React, { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { LimitedFieldLabel, LimitedInput, LimitedTextarea } from '../../components/LimitedField'
import { MaterialIcon } from '../../components/MaterialIcon'
import { ProgressLight, type ProgressState } from '../../components/ProgressLight'
import { SentimentPills, type SentimentValue } from '../../components/SentimentPills'
import { dateKeyForLocalDay } from '../../shared/dates'
import { isDebugMode } from '../../shared/debug/debugFlags'
import {
  draftFieldsOverLimit,
  ENTRY_BEHAVIOURS_NOTED_MAX,
  ENTRY_DETAILS_MAX,
  ENTRY_EMOTION_NOTE_MAX,
  ENTRY_REOCCURRING_THEME_MAX,
  ENTRY_SITUATION_MAX,
  isOverLimit,
} from '../../shared/limits/entryLimits'
import { useBodyScrollLock } from '../../shared/motion/useBodyScrollLock'
import { motionDuration, shouldReduceMotion } from '../../shared/motion/useMotionPrefs'
import { assessDraftRisk, assessRisk, type RiskAssessment } from '../safety/riskAssessment'
import { CrisisResourcePanel } from '../safety/CrisisResourcePanel'
import type { EntryEmotion, RiskLevel } from '../../db/schema'

export type Draft = {
  dateKey: string
  sentiment: SentimentValue
  emotion: EntryEmotion
  emotionNote: string
  situation: string
  details: string
  behavioursNoted: string
  reoccurringTheme: string
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
  behavioursNoted?: string
  reoccurringTheme?: string
}


export type Timeframe = 'just now' | 'an hour ago' | 'yesterday'

export type DraftInputState = {
  id: string
  sentiment: SentimentValue
  emotion: EntryEmotion
  emotionNote: string
  situation: string
  details: string
  behavioursNoted: string
  reoccurringTheme: string
  extrasOpen: boolean
  timeframe: Timeframe
}

export function LetterComposer({
  onSubmit,
  disabled = false,
}: {
  onSubmit: (drafts: Draft[]) => Promise<void> | void
  disabled?: boolean
}) {
  const [step, setStep] = useState<'write' | 'review'>('write')

  const createDraftInput = (): DraftInputState => ({
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
    sentiment: '+',
    emotion: 'happy',
    emotionNote: '',
    situation: '',
    details: '',
    behavioursNoted: '',
    reoccurringTheme: '',
    extrasOpen: false,
    timeframe: 'just now',
  })

  const [draftInputs, setDraftInputs] = useState<DraftInputState[]>([createDraftInput()])
  const [isBulkMode, setIsBulkMode] = useState(false)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitState, setSubmitState] = useState<'idle' | 'done' | 'error'>('idle')
  const [draftRisk, setDraftRisk] = useState<ReturnType<typeof assessDraftRisk> | null>(null)
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
      setDraftInputs([
        {
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
          sentiment: detail.sentiment,
          emotion: detail.emotion,
          emotionNote: detail.emotionNote,
          situation: detail.situation,
          details: detail.details,
          behavioursNoted: detail.behavioursNoted ?? '',
          reoccurringTheme: detail.reoccurringTheme ?? '',
          extrasOpen: Boolean(detail.behavioursNoted || detail.reoccurringTheme),
          timeframe: 'just now',
        },
      ])
      setIsBulkMode(false)
      setDraftRisk(null)
      setSubmitState('idle')
    }
    window.addEventListener('mentell:debug-ai-test-fill', fillDebugAiTest)
    return () => window.removeEventListener('mentell:debug-ai-test-fill', fillDebugAiTest)
  }, [])

  // Assess risk for the first draft (or all of them? just the first is fine for UI indicator,
  // but we assess all on submit anyway. Let's just do the first one for the live light)
  const primaryRiskInput = useMemo(
    () => ({
      dateKey,
      sentiment: draftInputs[0].sentiment,
      emotion: draftInputs[0].emotion,
      emotionNote: draftInputs[0].emotionNote,
      situation: draftInputs[0].situation,
      details: draftInputs[0].details,
    }),
    [dateKey, draftInputs],
  )

  useEffect(() => {
    let active = true
    const id = window.setTimeout(() => {
      const next = assessDraftRisk(primaryRiskInput)
      if (active) setDraftRisk(next)
    }, 250)
    return () => {
      active = false
      window.clearTimeout(id)
    }
  }, [primaryRiskInput])

  const progressState: ProgressState =
    draftRisk?.warningLevel === 'warn' ? 'warn' : step === 'review' ? 'review' : 'write'

  const activeDrafts = isBulkMode ? draftInputs : [draftInputs[0]]
  const anyDraftOverLimit = activeDrafts.some((d) => draftFieldsOverLimit(d))

  const updateDraft = (id: string, updates: Partial<DraftInputState>) => {
    setDraftInputs((prev) =>
      prev.map((draft) => (draft.id === id ? { ...draft, ...updates } : draft))
    )
  }

  const addDraft = () => {
    setDraftInputs((prev) => [...prev, createDraftInput()])
  }

  async function handleSubmit() {
    if (disabled || isSubmitting || anyDraftOverLimit) return
    setIsSubmitting(true)
    setSubmitState('idle')
    setSubmittedRisk(null)
    try {
      const finalDrafts: Draft[] = []
      let highestRisk: RiskAssessment | null = null

      for (const draft of (isBulkMode ? draftInputs : [draftInputs[0]])) {
        if (draftFieldsOverLimit(draft)) {
          throw new Error('One or more fields exceed the character limit.')
        }
        let draftDateKey = dateKey
        if (draft.timeframe === 'yesterday') {
           // We need a helper to get yesterday. We can import subDays from date-fns
           const yesterday = new Date()
           yesterday.setDate(yesterday.getDate() - 1)
           draftDateKey = '~' + dateKeyForLocalDay(yesterday)
        } else if (draft.timeframe === 'an hour ago') {
           draftDateKey = dateKey
        }

        const riskInputForDraft = {
          dateKey: draftDateKey,
          sentiment: draft.sentiment,
          emotion: draft.emotion,
          emotionNote: draft.emotionNote,
          situation: draft.situation,
          details: draft.details,
        }

        const finalRisk = await assessRisk(riskInputForDraft)

        const isCrisis = finalRisk.responseKind === 'crisis';
        const hasMessage = finalRisk.responseKind !== 'none' && !!finalRisk.supportiveMessage?.trim();
        const prevIsCrisis = highestRisk?.responseKind === 'crisis';
        const prevHasMessage = highestRisk?.responseKind !== 'none' && !!highestRisk?.supportiveMessage?.trim();

        if (!highestRisk) {
          highestRisk = finalRisk;
        } else if (isCrisis && !prevIsCrisis) {
          highestRisk = finalRisk;
        } else if (!prevIsCrisis && hasMessage && !prevHasMessage) {
          highestRisk = finalRisk;
        } else if (!prevIsCrisis && !prevHasMessage && finalRisk.riskScore > highestRisk.riskScore) {
          highestRisk = finalRisk;
        }

        finalDrafts.push({
          dateKey: draftDateKey,
          sentiment: draft.sentiment,
          emotion: draft.emotion,
          emotionNote: draft.emotion === 'other' ? draft.emotionNote.trim() : '',
          situation: draft.situation.trim(),
          details: draft.details.trim(),
          behavioursNoted: draft.behavioursNoted.trim(),
          reoccurringTheme: draft.reoccurringTheme.trim(),
          flaggedTerms: finalRisk.flaggedTerms,
          warningLevel: finalRisk.warningLevel,
          riskScore: finalRisk.riskScore,
          interventionScore: finalRisk.interventionScore,
          riskLevel: finalRisk.riskLevel,
        })
      }

      await onSubmit(finalDrafts)

      setStep('write')
      setDraftInputs([createDraftInput()])
      setIsBulkMode(false)
      setDraftRisk(null)
      setSubmitState('done')
      if (
        highestRisk &&
        (highestRisk.responseKind === 'crisis' ||
        (highestRisk.responseKind !== 'none' && highestRisk.supportiveMessage?.trim()))
      ) {
        setSubmittedRisk(highestRisk)
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
            <div className="font-paper text-2xl">{isBulkMode ? 'Bulk Submission' : 'Today’s letter'}</div>
            <div className="ink-muted mt-1 text-sm">Date: {dateKey}</div>
          </div>
          <SentimentPills value={draftInputs[0].sentiment} onChange={(val) => disabled ? {} : updateDraft(draftInputs[0].id, { sentiment: val })} />
        </header>

        <div className="mt-6 grid gap-5">
          <Field
            label="Situation"
            overLimit={isOverLimit(draftInputs[0].situation, ENTRY_SITUATION_MAX)}
          >
            <LimitedInput
              disabled={disabled}
              maxChars={ENTRY_SITUATION_MAX}
              value={draftInputs[0].situation}
              onChange={(e) => updateDraft(draftInputs[0].id, { situation: e.target.value })}
              placeholder="What happened?"
            />
          </Field>

          <Field
            label="Details"
            overLimit={isOverLimit(draftInputs[0].details, ENTRY_DETAILS_MAX)}
          >
            <LimitedTextarea
              disabled={disabled}
              maxChars={ENTRY_DETAILS_MAX}
              className="min-h-[180px]"
              value={draftInputs[0].details}
              onChange={(e) => updateDraft(draftInputs[0].id, { details: e.target.value })}
              placeholder="Write it like a letter you’re drafting…"
            />
          </Field>

          <EntryExtrasFields
            draft={draftInputs[0]}
            disabled={disabled}
            onChange={(updates) => updateDraft(draftInputs[0].id, updates)}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Emotion check‑in">
              <div className="grid gap-3">
                <select
                  disabled={disabled}
                  className="focus-ring w-full rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3 text-sm"
                  value={draftInputs[0].emotion}
                  onChange={(e) => updateDraft(draftInputs[0].id, { emotion: e.target.value as EntryEmotion })}
                >
                  {EMOTION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {draftInputs[0].emotion === 'other' ? (
                  <div className="grid gap-2">
                    <LimitedFieldLabel
                      label="Emotion name"
                      overLimit={isOverLimit(draftInputs[0].emotionNote, ENTRY_EMOTION_NOTE_MAX)}
                    />
                    <LimitedInput
                      disabled={disabled}
                      maxChars={ENTRY_EMOTION_NOTE_MAX}
                      value={draftInputs[0].emotionNote}
                      onChange={(e) => updateDraft(draftInputs[0].id, { emotionNote: e.target.value })}
                      placeholder="What emotion would you call this?"
                    />
                  </div>
                ) : null}
              </div>
            </Field>

            {isBulkMode ? (
              <Field label="When did this happen?">
                <select
                  disabled={disabled}
                  className="focus-ring w-full rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3 text-sm"
                  value={draftInputs[0].timeframe}
                  onChange={(e) => updateDraft(draftInputs[0].id, { timeframe: e.target.value as Timeframe })}
                >
                  <option value="just now">Just now</option>
                  <option value="an hour ago">An hour ago</option>
                  <option value="yesterday">Yesterday</option>
                </select>
              </Field>
            ) : null}
          </div>
        </div>

        {isBulkMode && draftInputs.length > 1 ? (
          <div className="mt-8 space-y-6">
            {draftInputs.slice(1).map((draft, index) => (
              <div key={draft.id} className="pt-6 border-t border-[var(--paper-border)] grid gap-5 relative">
                <div className="absolute top-6 right-0">
                  <SentimentPills value={draft.sentiment} onChange={(val) => disabled ? {} : updateDraft(draft.id, { sentiment: val })} />
                </div>
                <div className="font-paper text-xl">Additional entry {index + 1}</div>
                <Field
                  label="Situation"
                  overLimit={isOverLimit(draft.situation, ENTRY_SITUATION_MAX)}
                >
                  <LimitedInput
                    disabled={disabled}
                    maxChars={ENTRY_SITUATION_MAX}
                    value={draft.situation}
                    onChange={(e) => updateDraft(draft.id, { situation: e.target.value })}
                    placeholder="What happened?"
                  />
                </Field>
                <Field
                  label="Details"
                  overLimit={isOverLimit(draft.details, ENTRY_DETAILS_MAX)}
                >
                  <LimitedTextarea
                    disabled={disabled}
                    maxChars={ENTRY_DETAILS_MAX}
                    className="min-h-[120px]"
                    value={draft.details}
                    onChange={(e) => updateDraft(draft.id, { details: e.target.value })}
                    placeholder="Details for this entry…"
                  />
                </Field>
                <EntryExtrasFields
                  draft={draft}
                  disabled={disabled}
                  onChange={(updates) => updateDraft(draft.id, updates)}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Emotion check‑in">
                    <div className="grid gap-3">
                      <select
                        disabled={disabled}
                        className="focus-ring w-full rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3 text-sm"
                        value={draft.emotion}
                        onChange={(e) => updateDraft(draft.id, { emotion: e.target.value as EntryEmotion })}
                      >
                        {EMOTION_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </Field>
                  <Field label="When did this happen?">
                    <select
                      disabled={disabled}
                      className="focus-ring w-full rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3 text-sm"
                      value={draft.timeframe}
                      onChange={(e) => updateDraft(draft.id, { timeframe: e.target.value as Timeframe })}
                    >
                      <option value="just now">Just now</option>
                      <option value="an hour ago">An hour ago</option>
                      <option value="yesterday">Yesterday</option>
                    </select>
                  </Field>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {isBulkMode && step === 'review' ? (
          <div className="mt-6 flex justify-center">
             <button
                type="button"
                disabled={disabled}
                className="focus-ring w-full rounded-2xl border-2 border-dashed border-[var(--paper-border)] px-4 py-4 text-sm font-medium hover:bg-[var(--paper-border)]/20 transition-colors"
                onClick={addDraft}
              >
                + Add submission +
              </button>
          </div>
        ) : null}

        <footer className="mt-8 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="ink-muted min-w-0 flex-1 text-sm">
              {submitState === 'done' ? (
                <div className="font-medium" style={{ color: 'var(--success)' }}>
                  Submitted and cleared. Ready for your next entry.
                </div>
              ) : submitState === 'error' ? (
                <div className="font-medium" style={{ color: 'var(--danger)' }}>
                  Submit failed. Please try again.
                </div>
              ) : anyDraftOverLimit ? (
                <div className="font-medium" style={{ color: 'var(--danger)' }}>
                  Shorten the highlighted fields before you continue.
                </div>
              ) : draftRisk?.warningLevel === 'warn' ? (
                <DraftRiskNotice risk={draftRisk} />
              ) : step === 'write' ? (
                'When you’re ready, review it like a sealed note.'
              ) : (
                'Looks good? Submit when you’re ready.'
              )}
            </div>
            {step === 'review' && (
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer w-fit">
                <input
                  type="checkbox"
                  className="rounded border-[var(--paper-border)] text-black focus:ring-black"
                  checked={isBulkMode}
                  onChange={(e) => setIsBulkMode(e.target.checked)}
                  disabled={disabled}
                />
                More
              </label>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {step === 'review' ? (
              <button
                type="button"
                disabled={disabled || isSubmitting}
                className="focus-ring rounded-2xl border border-[var(--paper-border)] px-4 py-3 text-sm font-medium"
                onClick={() => setStep('write')}
              >
                Back to writing
              </button>
            ) : null}

            {step === 'write' ? (
              <button
                type="button"
                disabled={disabled || anyDraftOverLimit}
                className="btn-primary focus-ring rounded-2xl px-4 py-3 text-sm font-medium"
                onClick={() => setStep('review')}
              >
                Review
              </button>
            ) : (
              <button
                type="button"
                className="focus-ring rounded-2xl px-4 py-3 text-sm font-medium"
                style={{ background: 'var(--success)', color: 'rgba(0,0,0,0.92)' }}
                disabled={disabled || isSubmitting || anyDraftOverLimit}
                onClick={handleSubmit}
              >
                {isSubmitting ? <SubmitThrobber /> : 'Submit'}
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
function DraftRiskNotice({ risk }: { risk: ReturnType<typeof assessDraftRisk> }) {
  return (
    <div className="space-y-1">
      <div className="font-medium" style={{ color: 'var(--danger)' }}>
        I noticed this feels heavy. You are cared about.
      </div>
      <div>
        When you submit, Mentell can show support resources or a gentler note for what you wrote.
      </div>
      {isDebugMode() ? (
        <div className="font-mono text-[11px] uppercase opacity-70">
          Risk {risk.riskScore.toFixed(2)} · local
        </div>
      ) : null}
    </div>
  )
}

function SupportNotice({ risk }: { risk: RiskAssessment }) {
  const celebration = risk.responseKind === 'positive'
  const message = risk.supportiveMessage?.trim()
  return (
    <div className="space-y-2">
      <div className="font-medium" style={{ color: 'var(--success)' }}>
        {celebration ? 'This deserves a little confetti' : 'A small note for this moment'}
      </div>
      {message ? <div>{message}</div> : null}
      {isDebugMode() ? <RiskSignalLine risk={risk} /> : null}
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
      {risk.supportiveMessage?.trim() ? <div>{risk.supportiveMessage}</div> : null}
      {isDebugMode() ? <RiskSignalLine risk={risk} /> : null}
      {isDebugMode() && risk.reasons.length ? <div>Signals: {risk.reasons.join(', ')}</div> : null}
      {crisis ? <CrisisResourcePanel compact /> : null}
    </div>
  )
}

function RiskSignalLine({ risk }: { risk: RiskAssessment }) {
  const guard =
    risk.guardSafe === undefined ? '' : ` · guard ${risk.guardSafe ? 'safe' : 'unsafe'}`
  return (
    <div className="font-mono text-[11px] uppercase opacity-70">
      Literal {risk.literalSentimentLabel} {risk.literalSentimentConfidence.toFixed(2)} (
      {risk.literalSentimentScore.toFixed(2)}) · {risk.sentimentModelSource} · {risk.source}
      {guard}
    </div>
  )
}

function RiskResultModal({ risk, onClose }: { risk: RiskAssessment; onClose: () => void }) {
  const crisis = risk.responseKind === 'crisis'
  const celebration = risk.responseKind === 'positive'
  const titleId = 'risk-result-modal-title'
  const reduced = shouldReduceMotion()
  useBodyScrollLock(true)
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 p-4"
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduced ? undefined : { opacity: 0 }}
      transition={{ duration: motionDuration(0.2) || 0 }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="paper my-auto max-h-[min(90dvh,42rem)] w-full max-w-xl overflow-y-auto overscroll-contain rounded-3xl p-6 shadow-lg"
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
          {crisis ? <RiskNotice risk={risk} /> : <SupportNotice risk={risk} />}
        </div>
      </motion.div>
    </motion.div>
  )
}

function EntryExtrasFields({
  draft,
  disabled,
  onChange,
}: {
  draft: Pick<DraftInputState, 'behavioursNoted' | 'reoccurringTheme' | 'extrasOpen'>
  disabled?: boolean
  onChange: (updates: Partial<DraftInputState>) => void
}) {
  const expanded = draft.extrasOpen
  const behavioursOver = isOverLimit(draft.behavioursNoted, ENTRY_BEHAVIOURS_NOTED_MAX)
  const themeOver = isOverLimit(draft.reoccurringTheme, ENTRY_REOCCURRING_THEME_MAX)
  return (
    <div className="grid gap-3">
      <button
        type="button"
        disabled={disabled}
        className="focus-ring inline-flex w-fit items-center gap-1 rounded-xl border border-[var(--paper-border)] px-2.5 py-1.5 text-sm"
        aria-expanded={expanded}
        aria-label={expanded ? 'Hide extra entry details' : 'Show extra entry details'}
        onClick={() => onChange({ extrasOpen: !expanded })}
      >
        <MaterialIcon name={expanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down'} size={22} />
        <span className="ink-muted">{expanded ? 'Less' : 'More'}</span>
      </button>

      {expanded ? (
        <div className="grid gap-4 rounded-2xl border border-[var(--paper-border)] p-4">
          <Field label="Behaviours noted" overLimit={behavioursOver}>
            <LimitedTextarea
              disabled={disabled}
              maxChars={ENTRY_BEHAVIOURS_NOTED_MAX}
              className="min-h-[88px] text-base"
              value={draft.behavioursNoted}
              onChange={(e) => onChange({ behavioursNoted: e.target.value })}
              placeholder="What behaviours stood out in this interaction?"
            />
          </Field>
          <Field label="Reoccurring theme" overLimit={themeOver}>
            <LimitedInput
              disabled={disabled}
              maxChars={ENTRY_REOCCURRING_THEME_MAX}
              className="text-base"
              value={draft.reoccurringTheme}
              onChange={(e) => onChange({ reoccurringTheme: e.target.value })}
              placeholder="A reoccurring interaction type or theme…"
            />
          </Field>
        </div>
      ) : null}
    </div>
  )
}

function SubmitThrobber() {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-block size-4 animate-spin rounded-full border-2 border-black/25 border-t-black/80"
        aria-hidden
      />
      <span>Checking</span>
    </span>
  )
}

function Field({
  label,
  children,
  overLimit = false,
}: {
  label: string
  children: React.ReactNode
  overLimit?: boolean
}) {
  return (
    <label className="grid gap-2">
      <LimitedFieldLabel label={label} overLimit={overLimit} />
      {children}
    </label>
  )
}

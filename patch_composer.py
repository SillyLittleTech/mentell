import re

with open('src/features/compose/LetterComposer.tsx', 'r') as f:
    content = f.read()

# We need to change LetterComposer to manage an array of drafts instead of one.
# But `draftRisk` and `submittedRisk` must also be handled.

new_component = """
export type Timeframe = 'just now' | 'an hour ago' | 'yesterday'

export type DraftInputState = {
  id: string
  sentiment: SentimentValue
  emotion: EntryEmotion
  emotionNote: string
  situation: string
  details: string
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
    id: Math.random().toString(36).slice(2),
    sentiment: '+',
    emotion: 'happy',
    emotionNote: '',
    situation: '',
    details: '',
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
          id: Math.random().toString(36).slice(2),
          sentiment: detail.sentiment,
          emotion: detail.emotion,
          emotionNote: detail.emotionNote,
          situation: detail.situation,
          details: detail.details,
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

  const updateDraft = (id: string, updates: Partial<DraftInputState>) => {
    setDraftInputs((prev) =>
      prev.map((draft) => (draft.id === id ? { ...draft, ...updates } : draft))
    )
  }

  const addDraft = () => {
    setDraftInputs((prev) => [...prev, createDraftInput()])
  }

  async function handleSubmit() {
    if (disabled || isSubmitting) return
    setIsSubmitting(true)
    setSubmitState('idle')
    setSubmittedRisk(null)
    try {
      const finalDrafts: Draft[] = []
      let highestRisk: RiskAssessment | null = null

      for (const draft of draftInputs) {
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

        if (!highestRisk || finalRisk.riskScore > highestRisk.riskScore) {
          highestRisk = finalRisk
        }

        finalDrafts.push({
          dateKey: draftDateKey,
          sentiment: draft.sentiment,
          emotion: draft.emotion,
          emotionNote: draft.emotion === 'other' ? draft.emotionNote.trim() : '',
          situation: draft.situation.trim(),
          details: draft.details.trim(),
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
          <Field label="Situation">
            <input
              disabled={disabled}
              className="focus-ring w-full rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3 font-paper text-lg"
              value={draftInputs[0].situation}
              onChange={(e) => updateDraft(draftInputs[0].id, { situation: e.target.value })}
              placeholder="What happened?"
            />
          </Field>

          <Field label="Details">
            <textarea
              disabled={disabled}
              className="focus-ring min-h-[180px] w-full resize-y rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3 font-paper text-lg leading-relaxed"
              value={draftInputs[0].details}
              onChange={(e) => updateDraft(draftInputs[0].id, { details: e.target.value })}
              placeholder="Write it like a letter you’re drafting…"
            />
          </Field>

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
                  <input
                    disabled={disabled}
                    className="focus-ring w-full rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3 font-paper text-lg"
                    value={draftInputs[0].emotionNote}
                    onChange={(e) => updateDraft(draftInputs[0].id, { emotionNote: e.target.value })}
                    placeholder="What emotion would you call this?"
                  />
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
                <Field label="Situation">
                  <input
                    disabled={disabled}
                    className="focus-ring w-full rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3 font-paper text-lg"
                    value={draft.situation}
                    onChange={(e) => updateDraft(draft.id, { situation: e.target.value })}
                    placeholder="What happened?"
                  />
                </Field>
                <Field label="Details">
                  <textarea
                    disabled={disabled}
                    className="focus-ring min-h-[120px] w-full resize-y rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3 font-paper text-lg leading-relaxed"
                    value={draft.details}
                    onChange={(e) => updateDraft(draft.id, { details: e.target.value })}
                    placeholder="Details for this entry…"
                  />
                </Field>
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
"""

start_marker = "export function LetterComposer({"
end_marker = "function DraftRiskNotice("

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

# also need to replace the `onSubmit: (draft: Draft) => Promise<void> | void` with `drafts: Draft[]`
# But it's in the signature.
# So we can just replace everything from `export function LetterComposer` to `function DraftRiskNotice`.
content = content[:start_idx] + new_component + content[end_idx:]

with open('src/features/compose/LetterComposer.tsx', 'w') as f:
    f.write(content)

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ContactForQuestions } from '../legal/contactEmails'
import { scrollToTop } from '../../shared/motion/scroll'
import {
  feedbackFormConfigured,
  feedbackTurnstileSiteKey,
  submitFeedbackForm,
  type FeedbackFormInput,
  type FeedbackSubmissionType,
} from './feedbackSubmission'
import { FeedbackTurnstile } from './FeedbackTurnstile'

const SUBMISSION_TYPES: Array<{
  value: FeedbackSubmissionType
  title: string
  description: string
}> = [
  {
    value: 'Feedback',
    title: 'Feedback',
    description: 'Share a suggestion, a reaction to the app, or a new idea.',
  },
  {
    value: 'Bug Report',
    title: 'Bug report',
    description: 'Report broken behavior, missing content, or a reproduction path.',
  },
  {
    value: 'Privacy Inquiry',
    title: 'Privacy inquiry',
    description: 'Request access, correction, deletion, migration, or another privacy action.',
  },
  {
    value: 'Security Concern',
    title: 'Security concern',
    description: 'Report a vulnerability or a sensitive issue that should be handled carefully.',
  },
]

const BUG_FEATURES = [
  'AI Summaries',
  'Cloud Sync',
  'Drafting a Letter',
  'Viewing a Projection',
  'Sharing data',
  'Shoppe',
  'Other Settings',
  'Character',
  'Other',
] as const

const BUG_FREQUENCIES = ['Once', 'Rarely', 'Sometimes', 'Always'] as const

const FEEDBACK_PROMPTS = ['AI Summary', 'App Experience', 'New Feature', 'Other'] as const

const SECURITY_PRIORITIES = [
  { value: 0, label: 'P0', description: 'Urgent and active.' },
  { value: 1, label: 'P1', description: 'High impact.' },
  { value: 2, label: 'P2', description: 'Important, but not urgent.' },
  { value: 3, label: 'P3', description: 'Routine.' },
  { value: 4, label: 'P4', description: 'Low priority.' },
] as const

const PRIVACY_TYPES = [
  'Data Download Request',
  'Data Correction Request',
  'Data Deletion Request',
  'Account Deletion Request',
  'Account Migration Request',
  'Other',
] as const

type SignatureSnapshot = {
  dataUrl: string
  stampedAt: string | null
  hasInk: boolean
}

const selectFieldClassName =
  'focus-ring rounded-2xl border border-[var(--paper-border)] bg-[var(--paper-bg)] px-4 py-3 text-[var(--paper-ink)]'

function FieldLabel({
  children,
  required = false,
}: {
  children: ReactNode
  required?: boolean
}) {
  return (
    <span className="text-sm font-medium">
      {children}
      {required ? <span aria-hidden="true" className="ml-1 text-[var(--danger)]">*</span> : null}
    </span>
  )
}

export function FeedbackPage() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const formRef = useRef<HTMLFormElement | null>(null)
  const turnstileResponseRef = useRef('')

  const [title, setTitle] = useState('')
  const [submissionType, setSubmissionType] = useState<FeedbackSubmissionType>('Feedback')

  const [brDetails, setBrDetails] = useState('')
  const [brFeature, setBrFeature] = useState('')
  const [brFeatureOther, setBrFeatureOther] = useState('')
  const [brFrequency, setBrFrequency] = useState(2)
  const [brFiles, setBrFiles] = useState<File[]>([])

  const [fbDetails, setFbDetails] = useState('')
  const [fbPrompt, setFbPrompt] = useState('')
  const [fbPromptOther, setFbPromptOther] = useState('')
  const [fbSentiment, setFbSentiment] = useState(3)

  const [scPriority, setScPriority] = useState(2)
  const [scTarget, setScTarget] = useState('')
  const [scSensitive, setScSensitive] = useState<'Yes' | 'No' | ''>('')

  const [prEmail, setPrEmail] = useState('')
  const [prType, setPrType] = useState<string[]>([])
  const [prTarget, setPrTarget] = useState('')
  const [prRecipient, setPrRecipient] = useState('')
  const [prOther, setPrOther] = useState('')

  const [genOpEmail, setGenOpEmail] = useState('')

  const [signatureDataUrl, setSignatureDataUrl] = useState('')
  const [signatureStampedAt, setSignatureStampedAt] = useState<string | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [turnstileResponse, setTurnstileResponse] = useState('')

  useEffect(() => {
    scrollToTop()
  }, [pathname])

  const endpointReady = feedbackFormConfigured()
  const turnstileSiteKey = feedbackTurnstileSiteKey()
  const showPrivacyFields = submissionType === 'Privacy Inquiry'
  const showBugFields = submissionType === 'Bug Report'
  const showFeedbackFields = submissionType === 'Feedback'
  const showSecurityFields = submissionType === 'Security Concern'

  const selectedPrTypes = prType.join(', ')
  const selectedBugFeature = summarizeOtherAwareChoice(brFeature, brFeatureOther)
  const selectedFeedbackPrompt = summarizeOtherAwareChoice(fbPrompt, fbPromptOther)

  const getCurrentTurnstileResponse = () => {
    const domTurnstileResponse =
      formRef.current
        ?.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]')
        ?.value.trim() ?? ''

    return domTurnstileResponse || turnstileResponseRef.current.trim() || turnstileResponse.trim()
  }

  const validationError = () => {
    const currentTurnstileResponse = getCurrentTurnstileResponse()

    if (!title.trim()) return 'Add a title for your submission.'

    if (showBugFields) {
      if (!brDetails.trim()) return 'Describe the bug you ran into.'
      if (!brFeature) return 'Choose the affected feature.'
      if (brFeature === 'Other' && !brFeatureOther.trim()) {
        return 'Describe the other feature that was affected.'
      }
      if (brFiles.length > 3) {
        return 'Attach no more than 3 files.'
      }
    }

    if (showFeedbackFields) {
      if (!fbDetails.trim()) return 'Describe your feedback or suggestion.'
    }

    if (showSecurityFields) {
      if (scSensitive !== 'Yes' && scSensitive !== 'No') {
        return 'Choose whether this issue is sensitive.'
      }
    }

    if (showPrivacyFields) {
      if (!prEmail.trim()) return 'Add the account email for this privacy request.'
      if (prType.length === 0) return 'Choose at least one privacy request type.'
      if (prType.includes('Account Migration Request')) {
        if (!prTarget.trim()) return 'Add the target email for the migration request.'
        if (!prRecipient.trim()) return 'Add the new account email for the migration request.'
      }
      if (prType.includes('Other') && !prOther.trim()) {
        return 'Describe the other privacy request.'
      }
      if (!signatureDataUrl) return 'Draw your signature before submitting the privacy request.'
    }

    if (!currentTurnstileResponse) {
      return 'Complete the Cloudflare verification before submitting.'
    }

    return null
  }

  const handleFileChange = (files: FileList | null) => {
    setError(null)
    if (!files) {
      setBrFiles([])
      return
    }

    const next = Array.from(files)
    if (next.length > 3) {
      setBrFiles([])
      setError('Attach no more than 3 files.')
      return
    }

    const tooLarge = next.find((file) => file.size > 12 * 1024 * 1024)
    if (tooLarge) {
      setBrFiles([])
      setError(`"${tooLarge.name}" is larger than the 12 MB file limit.`)
      return
    }

    setBrFiles(next)
  }

  const handlePrTypeToggle = (value: string) => {
    setError(null)
    setPrType((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    )
  }

  const handleTurnstileTokenChange = (token: string) => {
    turnstileResponseRef.current = token
    setTurnstileResponse(token)
    if (token) setError(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const reportable = formRef.current?.reportValidity()
    if (reportable === false) return

    const customError = validationError()
    if (customError) {
      setError(customError)
      return
    }

    if (!endpointReady) {
      setError('Configure VITE_FEEDBACK_FORM_ENDPOINT in your local or GitHub environment.')
      return
    }

    const currentTurnstileResponse = getCurrentTurnstileResponse()

    const payload: FeedbackFormInput = {
      title,
      submissionType,
      brDetails,
      brFiles,
      brFeature,
      brFeatureOther,
      brFrequency,
      fbDetails,
      fbPrompt,
      fbPromptOther,
      fbSentiment,
      scPriority,
      scTarget,
      scSensitive,
      prEmail,
      prType,
      prTarget,
      prRecipient,
      prOther,
      genOpEmail,
      prSigBox: signatureDataUrl,
      turnstileResponse: currentTurnstileResponse,
    }

    setIsSubmitting(true)
    try {
      await submitFeedbackForm(payload, signatureStampedAt ?? new Date().toISOString())
      navigate('/feedback/thanks', { replace: true })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit the form.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <section className="paper rounded-3xl p-6">
        <div className="font-paper text-2xl">Feedback and requests</div>
        <p className="ink-muted mt-2 text-sm leading-relaxed">
          Use this form for bug reports, feature requests, privacy requests, and security concerns.
          The fields below expand based on the type of submission you choose.
        </p>
        <p className="ink-muted mt-3 text-sm leading-relaxed">
          If you need direct help instead, reach the Mentell team using the contact details on the
          privacy page or the direct email links below.
        </p>
        <div className="mt-4">
          <ContactForQuestions />
        </div>
        {!endpointReady ? (
          <div className="mt-5 rounded-2xl border border-[var(--paper-border)] bg-[rgba(198,29,29,0.08)] p-4 text-sm">
            Feedback submission is not enabled in this build yet. Set
            <code className="mx-1 font-mono text-[0.95em]">VITE_FEEDBACK_FORM_ENDPOINT</code>
            in your local environment and GitHub Actions variables to activate the workflow.
          </div>
        ) : null}
      </section>

      <form
        ref={formRef}
        className="space-y-4"
        onSubmit={handleSubmit}
        onInputCapture={() => {
          if (error) setError(null)
        }}
      >
        <CollapsibleCard
          title="Submission details"
          subtitle="Start with a clear title and choose what kind of request this is."
          summary={
            <div className="space-y-1">
              <div>
                <span className="font-medium">Type:</span> {submissionType}
              </div>
              <div className="ink-muted text-xs">
                {title.trim() ? `Title: ${title.trim()}` : 'The title is still blank.'}
              </div>
            </div>
          }
        >
          <div className="grid gap-4">
            <label className="grid gap-2">
                <FieldLabel required>Title</FieldLabel>
              <input
                type="text"
                className="focus-ring rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3"
                placeholder="A concise summary of what you want to send"
                maxLength={120}
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
              <span className="ink-muted text-xs">
                Keep it specific enough to sort quickly on the workflow side.
              </span>
            </label>

            <fieldset className="grid gap-3">
              <legend className="text-sm font-medium">What is the reason for your submission?</legend>
              <div className="grid gap-3 md:grid-cols-2">
                {SUBMISSION_TYPES.map((option) => {
                  const active = submissionType === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`focus-ring rounded-2xl border px-4 py-3 text-left transition ${
                        active
                          ? 'border-[rgba(42,155,88,0.55)] bg-[rgba(42,155,88,0.12)]'
                          : 'border-[var(--paper-border)] bg-transparent hover:-translate-y-[1px]'
                      }`}
                      aria-pressed={active}
                      onClick={() => {
                        setSubmissionType(option.value)
                        setError(null)
                      }}
                    >
                      <div className="font-medium">{option.title}</div>
                      <div className="ink-muted mt-1 text-xs leading-relaxed">
                        {option.description}
                      </div>
                    </button>
                  )
                })}
              </div>
            </fieldset>
          </div>
        </CollapsibleCard>

        {showBugFields ? (
          <CollapsibleCard
            title="Bug report details"
            subtitle="Describe what broke, what feature was affected, and how often it happens."
            summary={
              <div className="space-y-1 text-sm">
                <div>
                  <span className="font-medium">Feature:</span> {selectedBugFeature || 'Not set'}
                </div>
                <div>
                  <span className="font-medium">Frequency:</span>{' '}
                  {BUG_FREQUENCIES[brFrequency]}
                </div>
                <div className="ink-muted text-xs">
                  {brFiles.length ? `${brFiles.length} file(s) attached.` : 'No files attached.'}
                </div>
              </div>
            }
          >
            <div className="grid gap-4">
              <label className="grid gap-2">
                <FieldLabel required>Describe the bug</FieldLabel>
                <textarea
                  className="focus-ring min-h-[150px] rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3"
                  placeholder="Include steps to reproduce, screenshots, and error messages if you have them."
                  required
                  value={brDetails}
                  onChange={(event) => setBrDetails(event.target.value)}
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium">File upload</span>
                <input
                  type="file"
                  className="focus-ring rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3 text-sm"
                  accept="image/*,video/*"
                  multiple
                  onChange={(event) => handleFileChange(event.currentTarget.files)}
                />
                <span className="ink-muted text-xs">
                  Up to 3 files. Images and short video clips are the most useful.
                </span>
              </label>

              {brFiles.length ? (
                <div className="rounded-2xl border border-[var(--paper-border)] p-4">
                  <div className="text-sm font-medium">Selected files</div>
                  <ul className="mt-2 grid gap-2 text-sm">
                    {brFiles.map((file) => (
                      <li key={`${file.name}-${file.lastModified}`} className="ink-muted">
                        {file.name}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="grid gap-2">
                <FieldLabel required>Which feature was affected?</FieldLabel>
                <select
                  className={selectFieldClassName}
                  value={brFeature}
                  required
                  onChange={(event) => {
                    setBrFeature(event.target.value)
                    setError(null)
                    if (event.target.value !== 'Other') setBrFeatureOther('')
                  }}
                >
                  <option className="bg-[var(--paper-bg)] text-[var(--paper-ink)]" value="">
                    Select a feature
                  </option>
                  {BUG_FEATURES.map((feature) => (
                    <option
                      key={feature}
                      className="bg-[var(--paper-bg)] text-[var(--paper-ink)]"
                      value={feature}
                    >
                      {feature}
                    </option>
                  ))}
                </select>
                {brFeature === 'Other' ? (
                  <label className="grid gap-2">
                    <FieldLabel required>Describe the feature</FieldLabel>
                    <input
                      type="text"
                      className="focus-ring rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3"
                      placeholder="Describe the feature"
                      required
                      value={brFeatureOther}
                      onChange={(event) => setBrFeatureOther(event.target.value)}
                    />
                  </label>
                ) : null}
              </div>

              <div className="grid gap-2">
                <div className="flex items-end justify-between gap-3">
                  <span className="text-sm font-medium">How often does the bug occur?</span>
                  <span className="ink-muted text-xs">{BUG_FREQUENCIES[brFrequency]}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={3}
                  step={1}
                  className="w-full accent-[var(--accent)]"
                  value={brFrequency}
                  onChange={(event) => setBrFrequency(Number(event.target.value))}
                />
                <div className="flex justify-between text-[10px] font-medium uppercase tracking-wide text-[var(--paper-ink-muted)]">
                  {BUG_FREQUENCIES.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </div>
            </div>
          </CollapsibleCard>
        ) : null}

        {showFeedbackFields ? (
          <CollapsibleCard
            title="Feedback details"
            subtitle="Tell us what sparked the idea and how Mentell feels from your side."
            summary={
              <div className="space-y-1 text-sm">
                <div>
                  <span className="font-medium">Prompt:</span> {selectedFeedbackPrompt || 'Not set'}
                </div>
                <div>
                  <span className="font-medium">Sentiment:</span> {fbSentiment}/5
                </div>
              </div>
            }
          >
            <div className="grid gap-4">
              <label className="grid gap-2">
                <FieldLabel required>Describe your feedback or suggestion</FieldLabel>
                <textarea
                  className="focus-ring min-h-[150px] rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3"
                  placeholder="Feature requests, rough edges, or ideas that would make the app better."
                  required
                  value={fbDetails}
                  onChange={(event) => setFbDetails(event.target.value)}
                />
              </label>

              <div className="grid gap-2">
                <FieldLabel>What prompted your feedback?</FieldLabel>
                <select
                  className={selectFieldClassName}
                  value={fbPrompt}
                  onChange={(event) => {
                    setFbPrompt(event.target.value)
                    setError(null)
                    if (event.target.value !== 'Other') setFbPromptOther('')
                  }}
                >
                  <option className="bg-[var(--paper-bg)] text-[var(--paper-ink)]" value="">
                    Select a prompt
                  </option>
                  {FEEDBACK_PROMPTS.map((prompt) => (
                    <option
                      key={prompt}
                      className="bg-[var(--paper-bg)] text-[var(--paper-ink)]"
                      value={prompt}
                    >
                      {prompt}
                    </option>
                  ))}
                </select>
                <span className="ink-muted text-xs">
                  Please select an option, or leave this blank.
                </span>
                {fbPrompt === 'Other' ? (
                  <label className="grid gap-2">
                    <FieldLabel required>Describe what prompted it</FieldLabel>
                    <input
                      type="text"
                      className="focus-ring rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3"
                      placeholder="Describe what prompted it"
                      required
                      value={fbPromptOther}
                      onChange={(event) => setFbPromptOther(event.target.value)}
                    />
                  </label>
                ) : null}
              </div>

              <div className="grid gap-2">
                <span className="text-sm font-medium">How satisfied are you with Mentell?</span>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((value) => {
                    const active = fbSentiment === value
                    return (
                      <button
                        key={value}
                        type="button"
                        className={`focus-ring rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
                          active
                            ? 'border-[rgba(42,155,88,0.55)] bg-[rgba(42,155,88,0.12)]'
                            : 'border-[var(--paper-border)] bg-transparent hover:-translate-y-[1px]'
                        }`}
                        aria-pressed={active}
                        aria-label={`${value} star${value === 1 ? '' : 's'}`}
                        onClick={() => {
                          setFbSentiment(value)
                          setError(null)
                        }}
                      >
                        <div className="text-base">{value}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-wide text-[var(--paper-ink-muted)]">
                          {value <= 2 ? 'Negative' : value === 3 ? 'Neutral' : 'Positive'}
                        </div>
                      </button>
                    )
                  })}
                </div>
                <div className="flex justify-between text-[10px] font-medium uppercase tracking-wide text-[var(--paper-ink-muted)]">
                  <span>Negative</span>
                  <span>Positive</span>
                </div>
              </div>
            </div>
          </CollapsibleCard>
        ) : null}

        {showSecurityFields ? (
          <CollapsibleCard
            title="Security concern details"
            subtitle="Use this for vulnerabilities or other sensitive reports that need careful handling."
            summary={
              <div className="space-y-1 text-sm">
                <div>
                  <span className="font-medium">Priority:</span> P{scPriority}
                </div>
                <div>
                  <span className="font-medium">Sensitive:</span>{' '}
                  {scSensitive || 'Not set'}
                </div>
              </div>
            }
          >
            <div className="grid gap-4">
              <div className="grid gap-2">
                <div className="flex items-end justify-between gap-3">
                  <FieldLabel>Priority level</FieldLabel>
                  <span className="ink-muted text-xs">P{scPriority}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={4}
                  step={1}
                  className="w-full accent-[var(--accent)]"
                  value={scPriority}
                  onChange={(event) => setScPriority(Number(event.target.value))}
                />
                <div className="flex justify-between text-[10px] font-medium uppercase tracking-wide text-[var(--paper-ink-muted)]">
                  {SECURITY_PRIORITIES.map((item) => (
                    <span key={item.value}>{item.label}</span>
                  ))}
                </div>
              </div>

              <label className="grid gap-2">
                <FieldLabel>Target date</FieldLabel>
                <input
                  type="date"
                  className="focus-ring rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3"
                  value={scTarget}
                  onChange={(event) => setScTarget(event.target.value)}
                />
                <span className="ink-muted text-xs">Optional, if you want us to prioritize by date.</span>
              </label>

              <fieldset className="grid gap-2">
                <legend className="text-sm font-medium">
                  Is this issue sensitive?
                  <span aria-hidden="true" className="ml-1 text-[var(--danger)]">
                    *
                  </span>
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { value: 'Yes' as const, title: 'Sensitive', description: 'Handle carefully and keep access limited.' },
                    { value: 'No' as const, title: 'Not sensitive', description: 'Safe to discuss normally.' },
                  ].map((option) => {
                    const active = scSensitive === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`focus-ring rounded-2xl border px-4 py-3 text-left transition ${
                          active
                            ? 'border-[rgba(198,29,29,0.55)] bg-[rgba(198,29,29,0.1)]'
                            : 'border-[var(--paper-border)] bg-transparent hover:-translate-y-[1px]'
                        }`}
                        aria-pressed={active}
                        onClick={() => {
                          setScSensitive(option.value)
                          setError(null)
                        }}
                      >
                        <div className="font-medium">{option.title}</div>
                        <div className="ink-muted mt-1 text-xs leading-relaxed">
                          {option.description}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            </div>
          </CollapsibleCard>
        ) : null}

        {showPrivacyFields ? (
          <CollapsibleCard
            title="Privacy request details"
            subtitle="Use the same email address tied to the account, then choose one or more request types."
            summary={
              <div className="space-y-1 text-sm">
                <div>
                  <span className="font-medium">Types:</span> {selectedPrTypes || 'Not set'}
                </div>
                <div>
                  <span className="font-medium">Signature:</span>{' '}
                  {signatureDataUrl ? 'Captured' : 'Missing'}
                </div>
              </div>
            }
          >
            <div className="grid gap-4">
              <label className="grid gap-2">
                <FieldLabel required>Email</FieldLabel>
                <input
                  type="email"
                  className="focus-ring rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3"
                  placeholder="name@example.com"
                  required
                  value={prEmail}
                  onChange={(event) => setPrEmail(event.target.value)}
                />
              </label>

              <fieldset className="grid gap-3">
                <legend className="text-sm font-medium">
                  Type of inquiry
                  <span aria-hidden="true" className="ml-1 text-[var(--danger)]">
                    *
                  </span>
                </legend>
                <div className="grid gap-3">
                  {PRIVACY_TYPES.map((value) => {
                    const active = prType.includes(value)
                    return (
                      <label
                        key={value}
                        className={`focus-ring flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                          active
                            ? 'border-[rgba(42,155,88,0.55)] bg-[rgba(42,155,88,0.12)]'
                            : 'border-[var(--paper-border)] bg-transparent hover:-translate-y-[1px]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 accent-[var(--accent)]"
                          checked={active}
                          onChange={() => handlePrTypeToggle(value)}
                        />
                        <span className="text-sm">{value}</span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>

              {prType.includes('Account Migration Request') ? (
                <div className="grid gap-4 rounded-2xl border border-[var(--paper-border)] p-4">
                  <div className="text-sm font-medium">Migration request details</div>
                  <label className="grid gap-2">
                    <FieldLabel required>Target email</FieldLabel>
                    <input
                      type="email"
                      className="focus-ring rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3"
                      placeholder="target@example.com"
                      required
                      value={prTarget}
                      onChange={(event) => setPrTarget(event.target.value)}
                    />
                  </label>
                  <label className="grid gap-2">
                    <FieldLabel required>New account email</FieldLabel>
                    <input
                      type="email"
                      className="focus-ring rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3"
                      placeholder="new-account@example.com"
                      required
                      value={prRecipient}
                      onChange={(event) => setPrRecipient(event.target.value)}
                    />
                  </label>
                </div>
              ) : null}

              {prType.includes('Other') ? (
                <label className="grid gap-2">
                  <FieldLabel required>Other inquiry</FieldLabel>
                  <textarea
                    className="focus-ring min-h-[130px] rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3"
                    placeholder="Please specify the privacy request."
                    required
                    value={prOther}
                    onChange={(event) => setPrOther(event.target.value)}
                  />
                </label>
              ) : null}

              <div className="grid gap-2">
                <FieldLabel required>Signature</FieldLabel>
                <SignaturePad
                  onChange={(snapshot) => {
                    setSignatureDataUrl(snapshot.dataUrl)
                    setSignatureStampedAt(snapshot.stampedAt)
                    if (snapshot.dataUrl) setError(null)
                  }}
                />
              </div>
            </div>
          </CollapsibleCard>
        ) : null}

        {!showPrivacyFields ? (
          <CollapsibleCard
            title="Contact info"
            subtitle="Leave your email if you want a direct reply."
            summary={
              <div className="space-y-1 text-sm">
                <div>
                  <span className="font-medium">Reply email:</span>{' '}
                  {genOpEmail.trim() || 'Optional'}
                </div>
              </div>
            }
          >
            <label className="grid gap-2">
              <span className="text-sm font-medium">Your email (optional)</span>
              <input
                type="email"
                className="focus-ring rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3"
                placeholder="name@example.com"
                value={genOpEmail}
                onChange={(event) => setGenOpEmail(event.target.value)}
              />
              <span className="ink-muted text-xs">
                Leave this blank if you do not want a direct response.
              </span>
            </label>
          </CollapsibleCard>
        ) : null}

        <section className="paper rounded-3xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-paper text-xl">Submit</div>
              <div className="ink-muted mt-1 text-sm">
                The form posts to the configured workflow endpoint and then redirects to a thank-you page.
              </div>
            </div>
            <div className="ink-muted text-xs">
              {showPrivacyFields ? 'Signature required.' : 'Optional reply email available.'}
            </div>
          </div>

          <div className="mt-5">
            <FeedbackTurnstile
              key={turnstileSiteKey}
              siteKey={turnstileSiteKey}
              onTokenChange={handleTurnstileTokenChange}
            />
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-[rgba(198,29,29,0.35)] bg-[rgba(198,29,29,0.08)] p-4 text-sm text-[var(--paper-ink)]">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting || !endpointReady || !turnstileResponse.trim()}
            className="focus-ring mt-5 w-full rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Sending...' : 'Submit inquiry'}
          </button>
          <p className="ink-muted mt-3 text-xs leading-relaxed">
            By submitting, you agree that Mentell may process the information you provide through
            the configured workflow. Please avoid including more personal data than is necessary for
            the request.
          </p>
        </section>
      </form>
    </div>
  )
}

export function FeedbackThankYouPage() {
  const { pathname } = useLocation()

  useEffect(() => {
    scrollToTop()
  }, [pathname])

  return (
    <div className="space-y-4">
      <section className="paper rounded-3xl p-6 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-[var(--paper-border)] bg-[rgba(42,155,88,0.1)]">
          <PaperPlaneIcon className="h-10 w-10 text-[var(--success)]" />
        </div>
        <div className="mt-5 font-paper text-2xl">Thanks for the feedback</div>
        <p className="ink-muted mt-3 text-sm leading-relaxed">
          Feedback helps us improve. We appreciate the time you took to send us a bug report,
          request, or privacy note.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            to="/feedback"
            className="focus-ring rounded-2xl border border-[var(--paper-border)] px-4 py-3 text-sm font-semibold"
          >
            Send another response
          </Link>
          <Link
            to="/"
            className="focus-ring rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white"
          >
            Back to journal
          </Link>
        </div>
      </section>
    </div>
  )
}

function CollapsibleCard({
  title,
  subtitle,
  summary,
  children,
}: {
  title: string
  subtitle: string
  summary: ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useState(true)

  return (
    <section className="paper rounded-3xl p-6">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-4 text-left"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <div>
          <div className="font-paper text-xl">{title}</div>
          <div className="ink-muted mt-1 text-sm">{subtitle}</div>
        </div>
        <div className="rounded-full border border-[var(--paper-border)] px-3 py-1 text-xs font-semibold uppercase tracking-wide">
          {open ? 'Collapse' : 'Edit'}
        </div>
      </button>

      {open ? (
        <div className="mt-5">{children}</div>
      ) : (
        <div className="mt-5 rounded-2xl border border-[var(--paper-border)] bg-[rgba(255,255,255,0.22)] p-4">
          {summary}
        </div>
      )}
    </section>
  )
}

function SignaturePad({
  onChange,
}: {
  onChange: (snapshot: SignatureSnapshot) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const onChangeRef = useRef(onChange)
  const drawingRef = useRef(false)
  const hasInkRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const stampedAtRef = useRef<string | null>(null)
  const [hasInk, setHasInk] = useState(false)
  const [stampedAt, setStampedAt] = useState<string | null>(null)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const width = Math.max(280, rect.width)
      const height = 180
      const dpr = window.devicePixelRatio || 1

      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      ctx.lineWidth = 2.4
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle =
        getComputedStyle(document.documentElement).getPropertyValue('--paper-ink').trim() || '#19181f'
      ctx.fillStyle = ctx.strokeStyle
    }

    resize()
    onChangeRef.current({ dataUrl: '', stampedAt: null, hasInk: false })
  }, [])

  const syncSnapshot = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dataUrl = hasInkRef.current ? canvas.toDataURL('image/png') : ''
    onChangeRef.current({
      dataUrl,
      stampedAt: stampedAtRef.current,
      hasInk: hasInkRef.current,
    })
  }

  const getPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }

  const drawDot = (ctx: CanvasRenderingContext2D, point: { x: number; y: number }) => {
    ctx.beginPath()
    ctx.arc(point.x, point.y, 1.2, 0, Math.PI * 2)
    ctx.fill()
  }

  const drawLine = (ctx: CanvasRenderingContext2D, start: { x: number; y: number }, end: { x: number; y: number }) => {
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
    ctx.stroke()
  }

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    event.currentTarget.setPointerCapture(event.pointerId)
    drawingRef.current = true
    const point = getPoint(event)
    lastPointRef.current = point
    if (!stampedAtRef.current) {
      stampedAtRef.current = new Date().toISOString()
      setStampedAt(stampedAtRef.current)
    }
    hasInkRef.current = true
    setHasInk(true)
    drawDot(ctx, point)
    syncSnapshot()
  }

  const finishStroke = () => {
    if (!drawingRef.current) return
    drawingRef.current = false
    lastPointRef.current = null
    syncSnapshot()
  }

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !lastPointRef.current) return

    const point = getPoint(event)
    drawLine(ctx, lastPointRef.current, point)
    lastPointRef.current = point
    hasInkRef.current = true
    setHasInk(true)
    syncSnapshot()
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const rect = canvas.getBoundingClientRect()
    ctx.clearRect(0, 0, rect.width, rect.height)
    drawingRef.current = false
    lastPointRef.current = null
    stampedAtRef.current = null
    hasInkRef.current = false
    setHasInk(false)
    setStampedAt(null)
    onChangeRef.current({ dataUrl: '', stampedAt: null, hasInk: false })
  }

  return (
    <section className="rounded-2xl border border-[var(--paper-border)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Signature</div>
          <div className="ink-muted mt-1 text-xs leading-relaxed">
            Draw a simple signature to confirm the privacy request. The timestamp is captured when
            you start signing.
          </div>
        </div>
        <button
          type="button"
          className="focus-ring rounded-xl border border-[var(--paper-border)] px-3 py-2 text-xs font-semibold disabled:opacity-50"
          onClick={clear}
          disabled={!hasInk}
        >
          Clear
        </button>
      </div>

      <canvas
        ref={canvasRef}
        className="focus-ring mt-4 h-[180px] w-full rounded-2xl border border-[var(--paper-border)] bg-[rgba(255,255,255,0.18)]"
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
        onPointerLeave={finishStroke}
      />

      <div className="ink-muted mt-2 text-xs">
        {stampedAt ? `Signed at ${new Date(stampedAt).toLocaleString()}` : 'No signature captured yet.'}
      </div>
    </section>
  )
}

function PaperPlaneIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="m4 11.75 15.75-6.2c.45-.18.92.25.74.7l-5.62 14.2c-.17.43-.78.42-.93-.02l-1.55-4.57-4.57-1.55-3.8-1.3a.6.6 0 0 1-.02-.98Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="m19.1 5.93-8.78 8.79"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function summarizeOtherAwareChoice(value: string, other: string) {
  if (!value) return ''
  if (value === 'Other' && other.trim()) return `Other: ${other.trim()}`
  return value
}

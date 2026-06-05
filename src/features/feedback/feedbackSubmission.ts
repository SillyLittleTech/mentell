export type FeedbackSubmissionType =
  | 'Feedback'
  | 'Bug Report'
  | 'Privacy Inquiry'
  | 'Security Concern'

export type FeedbackFormInput = {
  title: string
  submissionType: FeedbackSubmissionType
  brDetails: string
  brFiles: File[]
  brFeature: string
  brFeatureOther: string
  brFrequency: number
  fbDetails: string
  fbPrompt: string
  fbPromptOther: string
  fbSentiment: number
  scPriority: number
  scTarget: string
  scSensitive: 'Yes' | 'No' | ''
  prEmail: string
  prType: string[]
  prTarget: string
  prRecipient: string
  prOther: string
  genOpEmail: string
  prSigBox: string
  turnstileResponse: string
}

const DEFAULT_TURNSTILE_SITE_KEY = '0x4AAAAAADfOpVgdUWD5E_c1'

export function normalizeEndpointUrl(raw: string) {
  const endpoint = raw.trim()
  if (!endpoint) return endpoint
  if (/^https?:\/\//i.test(endpoint)) return endpoint.replace(/\/$/, '')
  if (endpoint.startsWith('/')) return endpoint.replace(/\/$/, '')
  return `https://${endpoint}`.replace(/\/$/, '')
}

export function feedbackFormEndpoint() {
  const raw = import.meta.env.VITE_FEEDBACK_FORM_ENDPOINT?.trim() ?? ''
  return normalizeEndpointUrl(raw)
}

export function feedbackFormConfigured() {
  return feedbackFormEndpoint().length > 0
}

export function feedbackTurnstileSiteKey() {
  return import.meta.env.VITE_FEEDBACK_TURNSTILE_SITE_KEY?.trim() || DEFAULT_TURNSTILE_SITE_KEY
}

function trimOrEmpty(value: string) {
  return value.trim()
}

function selectedFeatureLabel(feature: string, other: string) {
  if (feature === 'Other' && other.trim()) return `Other: ${trimOrEmpty(other)}`
  return feature
}

function selectedPromptLabel(prompt: string, other: string) {
  if (prompt === 'Other' && other.trim()) return `Other: ${trimOrEmpty(other)}`
  return prompt
}

function selectedPrivacyTypes(types: string[], other: string) {
  return types
    .map((type) => {
      if (type !== 'Other') return type
      return other.trim() ? `Other: ${trimOrEmpty(other)}` : 'Other'
    })
    .join(', ')
}

function bugFrequencyLabel(freq: number) {
  return ['Once', 'Rarely', 'Sometimes', 'Always'][Math.max(0, Math.min(3, freq))]
}

function feedbackSentimentLabel(sentiment: number) {
  return String(Math.max(1, Math.min(5, sentiment)))
}

function priorityLabel(priority: number) {
  return `P${Math.max(0, Math.min(4, priority))}`
}

function appendHiddenInput(form: HTMLFormElement, name: string, value: string) {
  const input = document.createElement('input')
  input.type = 'hidden'
  input.name = name
  input.value = trimOrEmpty(value)
  form.appendChild(input)
}

function appendFileInput(form: HTMLFormElement, name: string, files: File[]) {
  if (files.length === 0) return

  const input = document.createElement('input')
  input.type = 'file'
  input.name = name
  input.multiple = true

  const transfer = new DataTransfer()
  files.slice(0, 3).forEach((file) => {
    transfer.items.add(file)
  })
  input.files = transfer.files
  form.appendChild(input)
}

function createSubmissionForm(
  endpoint: string,
  input: FeedbackFormInput,
  dateStamp: string,
  targetName: string,
) {
  const form = document.createElement('form')
  form.action = endpoint
  form.method = 'post'
  form.enctype =
    input.submissionType === 'Bug Report' && input.brFiles.length > 0
      ? 'multipart/form-data'
      : 'application/x-www-form-urlencoded'
  form.target = targetName
  form.style.position = 'fixed'
  form.style.left = '-9999px'
  form.style.top = '0'
  form.style.width = '1px'
  form.style.height = '1px'
  form.style.opacity = '0'
  form.style.pointerEvents = 'none'

  appendHiddenInput(form, 'title', input.title)
  appendHiddenInput(form, 'submissionType', input.submissionType)
  appendHiddenInput(form, 'brDetails', input.submissionType === 'Bug Report' ? input.brDetails : '')
  appendHiddenInput(
    form,
    'brFeature',
    input.submissionType === 'Bug Report'
      ? selectedFeatureLabel(input.brFeature, input.brFeatureOther)
      : '',
  )
  appendHiddenInput(
    form,
    'brFrequency',
    input.submissionType === 'Bug Report' ? bugFrequencyLabel(input.brFrequency) : '',
  )
  appendHiddenInput(form, 'fbDetails', input.submissionType === 'Feedback' ? input.fbDetails : '')
  appendHiddenInput(
    form,
    'fbPrompt',
    input.submissionType === 'Feedback'
      ? selectedPromptLabel(input.fbPrompt, input.fbPromptOther)
      : '',
  )
  appendHiddenInput(
    form,
    'fbSentiment',
    input.submissionType === 'Feedback' ? feedbackSentimentLabel(input.fbSentiment) : '',
  )
  appendHiddenInput(
    form,
    'scPriority',
    input.submissionType === 'Security Concern' ? priorityLabel(input.scPriority) : '',
  )
  appendHiddenInput(
    form,
    'scTarget',
    input.submissionType === 'Security Concern' ? input.scTarget : '',
  )
  appendHiddenInput(
    form,
    'scSensitive',
    input.submissionType === 'Security Concern' ? input.scSensitive : '',
  )
  appendHiddenInput(form, 'prEmail', input.submissionType === 'Privacy Inquiry' ? input.prEmail : '')
  appendHiddenInput(
    form,
    'prType',
    input.submissionType === 'Privacy Inquiry'
      ? selectedPrivacyTypes(input.prType, input.prOther)
      : '',
  )
  appendHiddenInput(
    form,
    'prTarget',
    input.submissionType === 'Privacy Inquiry' ? input.prTarget : '',
  )
  appendHiddenInput(
    form,
    'prRecipient',
    input.submissionType === 'Privacy Inquiry' ? input.prRecipient : '',
  )
  appendHiddenInput(form, 'prOther', input.submissionType === 'Privacy Inquiry' ? input.prOther : '')
  appendHiddenInput(
    form,
    'genOpEmail',
    input.submissionType === 'Privacy Inquiry' ? '' : input.genOpEmail,
  )
  appendHiddenInput(
    form,
    'prSigBox',
    input.submissionType === 'Privacy Inquiry' ? input.prSigBox : '',
  )
  appendHiddenInput(form, 'DateStamp', dateStamp)
  appendHiddenInput(form, 'cf-turnstile-response', input.turnstileResponse)

  if (input.submissionType === 'Bug Report') {
    appendFileInput(form, 'brFile', input.brFiles)
  }

  return form
}

export async function submitFeedbackForm(input: FeedbackFormInput, dateStamp: string) {
  const endpoint = feedbackFormEndpoint()
  if (!endpoint) {
    throw new Error('Configure VITE_FEEDBACK_FORM_ENDPOINT to enable feedback submissions.')
  }
  if (!input.turnstileResponse.trim()) {
    throw new Error('Complete the Cloudflare verification before submitting.')
  }

  const targetName = `feedback-submit-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const iframe = document.createElement('iframe')
  iframe.name = targetName
  iframe.title = 'Feedback submission target'
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.left = '-9999px'
  iframe.style.top = '0'
  iframe.style.width = '1px'
  iframe.style.height = '1px'
  iframe.style.border = '0'
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'

  const form = createSubmissionForm(endpoint, input, dateStamp, targetName)

  document.body.appendChild(iframe)
  document.body.appendChild(form)

  try {
    form.submit()
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 0)
    })
  } finally {
    window.setTimeout(() => {
      iframe.remove()
      form.remove()
    }, 1000)
  }
}

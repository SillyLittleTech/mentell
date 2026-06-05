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

function appendText(formData: FormData, name: string, value: string) {
  formData.set(name, trimOrEmpty(value))
}

export function buildFeedbackFormData(input: FeedbackFormInput, dateStamp: string) {
  const formData = new FormData()

  appendText(formData, 'title', input.title)
  appendText(formData, 'submissionType', input.submissionType)
  appendText(formData, 'brDetails', input.submissionType === 'Bug Report' ? input.brDetails : '')
  appendText(
    formData,
    'brFeature',
    input.submissionType === 'Bug Report'
      ? selectedFeatureLabel(input.brFeature, input.brFeatureOther)
      : '',
  )
  appendText(
    formData,
    'brFrequency',
    input.submissionType === 'Bug Report' ? bugFrequencyLabel(input.brFrequency) : '',
  )
  appendText(formData, 'fbDetails', input.submissionType === 'Feedback' ? input.fbDetails : '')
  appendText(
    formData,
    'fbPrompt',
    input.submissionType === 'Feedback'
      ? selectedPromptLabel(input.fbPrompt, input.fbPromptOther)
      : '',
  )
  appendText(
    formData,
    'fbSentiment',
    input.submissionType === 'Feedback' ? feedbackSentimentLabel(input.fbSentiment) : '',
  )
  appendText(
    formData,
    'scPriority',
    input.submissionType === 'Security Concern' ? priorityLabel(input.scPriority) : '',
  )
  appendText(formData, 'scTarget', input.submissionType === 'Security Concern' ? input.scTarget : '')
  appendText(
    formData,
    'scSensitive',
    input.submissionType === 'Security Concern' ? input.scSensitive : '',
  )
  appendText(formData, 'prEmail', input.submissionType === 'Privacy Inquiry' ? input.prEmail : '')
  appendText(
    formData,
    'prType',
    input.submissionType === 'Privacy Inquiry'
      ? selectedPrivacyTypes(input.prType, input.prOther)
      : '',
  )
  appendText(formData, 'prTarget', input.submissionType === 'Privacy Inquiry' ? input.prTarget : '')
  appendText(
    formData,
    'prRecipient',
    input.submissionType === 'Privacy Inquiry' ? input.prRecipient : '',
  )
  appendText(formData, 'prOther', input.submissionType === 'Privacy Inquiry' ? input.prOther : '')
  appendText(
    formData,
    'genOpEmail',
    input.submissionType === 'Privacy Inquiry' ? '' : input.genOpEmail,
  )
  appendText(
    formData,
    'prSigBox',
    input.submissionType === 'Privacy Inquiry' ? input.prSigBox : '',
  )
  appendText(formData, 'DateStamp', dateStamp)
  appendText(formData, 'cf-turnstile-response', input.turnstileResponse)

  if (input.submissionType === 'Bug Report') {
    input.brFiles.slice(0, 3).forEach((file) => {
      formData.append('brFile', file, file.name)
    })
  }

  return formData
}

async function readEndpointError(response: Response) {
  try {
    const body = (await response.clone().json()) as { error?: unknown; message?: unknown }
    const value = typeof body.error === 'string' ? body.error : body.message
    return typeof value === 'string' && value.trim() ? value.trim() : ''
  } catch {
    try {
      const text = await response.clone().text()
      return text.trim().slice(0, 180)
    } catch {
      return ''
    }
  }
}

export async function submitFeedbackForm(input: FeedbackFormInput, dateStamp: string) {
  const endpoint = feedbackFormEndpoint()
  if (!endpoint) {
    throw new Error('Configure VITE_FEEDBACK_FORM_ENDPOINT to enable feedback submissions.')
  }
  if (!input.turnstileResponse.trim()) {
    throw new Error('Complete the Cloudflare verification before submitting.')
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
    body: buildFeedbackFormData(input, dateStamp),
  })

  if (!response.ok) {
    const detail = await readEndpointError(response)
    throw new Error(`Feedback endpoint error (${response.status}).${detail ? ` ${detail}` : ''}`)
  }

  return response
}

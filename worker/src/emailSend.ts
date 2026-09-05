import { Resend } from 'resend'
import type { Env } from './env'
import { runWorkersAi, extractAiText } from './aiGateway'

export type EmailTemplateKind = 'daily' | 'package' | 'verify'

export type SendEmailResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; status?: number }

const DEFAULT_FROM = 'Mentell <notifications@mentell.slt.ong>'

const KIND_ALIASES: Record<EmailTemplateKind, string[]> = {
  daily: ['daily', 'mentell-daily', 'daily-reminder', 'adherence'],
  package: ['package', 'mentell-package', 'weekly-package', 'package-drop'],
  verify: ['verify', 'mentell-verify', 'verification', 'email-verify'],
}

type TemplateRecord = {
  id: string
  name?: string
  alias?: string | null
  status?: string
  html?: string | null
  text?: string | null
  subject?: string | null
  from?: string | null
  variables?: { key: string; fallback_value?: string | number | null }[] | null
}

function envTemplateId(env: Env, kind: EmailTemplateKind) {
  if (kind === 'daily') return env.RESEND_TEMPLATE_DAILY?.trim()
  if (kind === 'package') return env.RESEND_TEMPLATE_PACKAGE?.trim()
  return env.RESEND_TEMPLATE_VERIFY?.trim()
}

function expandTemplateVariables(variables: Record<string, string | number>) {
  const out: Record<string, string | number> = { ...variables }
  for (const [key, value] of Object.entries(variables)) {
    out[key.toUpperCase()] = value
  }

  const name = String(variables.global_name ?? variables.NAME ?? variables.name ?? '').trim()
  if (name && name.toLowerCase() !== 'there') {
    for (const key of ['NAME', 'name', 'Name', 'global_name', 'GLOBAL_NAME', 'user_name', 'USER_NAME', 'first_name', 'FIRST_NAME']) {
      out[key] = name
    }
  }

  if (variables.verify_url) {
    out.VERIFY_URL = variables.verify_url
    out.verifyUrl = variables.verify_url
  }
  if (variables.verify_token) {
    out.VERIFY_TOKEN = variables.verify_token
  }
  return out
}

function applyVariables(
  source: string,
  variables: Record<string, string | number>,
  defs?: TemplateRecord['variables'],
) {
  const values: Record<string, string> = {}
  for (const def of defs ?? []) {
    if (def.fallback_value != null && def.fallback_value !== '') {
      values[def.key] = String(def.fallback_value)
    }
  }
  for (const [key, value] of Object.entries(expandTemplateVariables(variables))) {
    const text = String(value).trim()
    if (text) values[key] = text
  }

  let out = source
  for (const [key, value] of Object.entries(values)) {
    out = out.split(`{{{${key}}}}`).join(value)
    out = out.split(`{{${key}}}`).join(value)
  }
  return out
}

function sdkErrorMessage(error: { message?: string } | null | undefined, fallback: string) {
  return error?.message?.trim() || fallback
}

/** SDK GET can surface "No Content" when Resend returns an empty 2xx; retry with a plain fetch. */
async function getTemplate(resend: Resend, apiKey: string, identifier: string): Promise<SendEmailResult & { template?: TemplateRecord }> {
  const result = await resend.templates.get(identifier)
  if (result.data?.html) {
    return { ok: true, template: result.data }
  }

  const response = await fetch(`https://api.resend.com/templates/${encodeURIComponent(identifier)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  const text = await response.text().catch(() => '')
  if (response.ok && text) {
    try {
      const parsed = JSON.parse(text) as TemplateRecord
      if (parsed.html) return { ok: true, template: parsed }
    } catch {
      /* fall through */
    }
  }

  const error = sdkErrorMessage(
    result.error,
    text || `${response.status} ${response.statusText || 'No Content'}`,
  )
  return { ok: false, error: `templates.get(${identifier}): ${error}`, status: response.status }
}

function matchListedTemplate(kind: EmailTemplateKind, templates: TemplateRecord[]) {
  const needles = KIND_ALIASES[kind]
  const scored = templates
    .map((template) => {
      const alias = (template.alias || '').toLowerCase()
      const name = (template.name || '').toLowerCase()
      let score = 0
      if (alias === kind) score += 100
      if (name === kind) score += 80
      for (const needle of needles) {
        if (alias === needle) score += 60
        if (alias.includes(needle)) score += 20
        if (name.includes(needle)) score += 15
      }
      if (template.status === 'published') score += 10
      return { template, score }
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
  return scored[0]?.template
}

async function resolveTemplate(
  resend: Resend,
  apiKey: string,
  env: Env,
  kind: EmailTemplateKind,
): Promise<SendEmailResult & { template?: TemplateRecord }> {
  const errors: string[] = []
  const envId = envTemplateId(env, kind)
  const identifiers = envId && envId !== kind ? [envId, kind] : [kind]

  for (const identifier of identifiers) {
    const got = await getTemplate(resend, apiKey, identifier)
    if (got.ok && got.template) return got
    if (!got.ok) errors.push(got.error)
  }

  const listed = await resend.templates.list({ limit: 100 })
  if (listed.error) {
    errors.push(`templates.list: ${listed.error.message}`)
  } else {
    const match = matchListedTemplate(kind, listed.data?.data ?? [])
    const matchId = match?.alias || match?.id
    if (matchId && !identifiers.includes(matchId)) {
      const got = await getTemplate(resend, apiKey, matchId)
      if (got.ok && got.template) return got
      if (!got.ok) errors.push(got.error)
    }
  }

  return {
    ok: false,
    error:
      errors[0] ||
      `No Resend template found for "${kind}". Publish a template whose alias is "${kind}", or set RESEND_TEMPLATE_${kind.toUpperCase()} to the template id.`,
  }
}

export async function sendResendEmail(
  env: Env,
  kind: EmailTemplateKind,
  to: string,
  variables: Record<string, string | number>,
): Promise<SendEmailResult> {
  const apiKey = env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    return { ok: false, error: 'RESEND_API_KEY is not set on the worker' }
  }

  const resend = new Resend(apiKey)
  const resolved = await resolveTemplate(resend, apiKey, env, kind)
  if (!resolved.ok || !resolved.template) {
    return { ok: false, error: !resolved.ok ? resolved.error : 'No template', status: !resolved.ok ? resolved.status : undefined }
  }

  const template = resolved.template
  const html = applyVariables(template.html ?? '', variables, template.variables)
  if (!html.trim()) {
    return { ok: false, error: `Resend template "${template.alias || template.id}" has no HTML (publish it in Resend)` }
  }

  const from = template.from?.trim() || env.RESEND_FROM?.trim() || DEFAULT_FROM
  const subject = applyVariables(template.subject?.trim() || 'Mentell', variables, template.variables)
  const text = template.text ? applyVariables(template.text, variables, template.variables) : undefined

  const sent = await resend.emails.send({
    from,
    to,
    subject,
    html,
    ...(text ? { text } : {}),
  })

  if (sent.error) {
    console.error('Error sending Resend email:', sent.error.message)
    return { ok: false, error: sent.error.message, status: sent.error.statusCode ?? undefined }
  }

  return { ok: true, id: sent.data?.id }
}

export async function generateWeeklySummary(
  env: Env,
  _uid: string,
  _weekKey: string,
  _startKey: string,
  _endKey: string,
  globalName?: string,
  disableAi?: boolean
): Promise<string> {
  if (disableAi) {
    return 'AI Features are disabled, enable in the settings.'
  }

  try {
    const result = await runWorkersAi(env, '@cf/meta/llama-4-scout-17b-16e-instruct', {
      messages: [
        {
          role: 'system',
          content: 'You generate short motivational summaries for a weekly mental health journal package. Be very brief (1-2 sentences) and encouraging. Address the user by name if provided.',
        },
        {
          role: 'user',
          content: `Write a short weekly summary for ${globalName || 'this user'}.`,
        },
      ],
      max_tokens: 64,
    })
    return extractAiText(result).trim() || 'Your weekly package is ready to open.'
  } catch {
    return 'Your weekly package is ready to open.'
  }
}

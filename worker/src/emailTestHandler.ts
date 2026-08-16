import { corsJson, corsResponse } from './cors'
import type { Env } from './env'
import { sendResendEmail } from './emailSend'

export async function handleEmailTest(request: Request, env: Env) {
  const origin = request.headers.get('Origin')
  if (request.method === 'OPTIONS') return corsResponse(null, 204, env, origin)

  if (request.method !== 'POST') {
    return corsJson({ error: 'Method not allowed' }, 405, env, origin)
  }

  let body: { email: string; template: 'daily' | 'package'; variables: Record<string, string> }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return corsJson({ error: 'Invalid JSON' }, 400, env, origin)
  }

  if (!body.email || body.email.length > 254 || body.email.indexOf('@') < 1 || body.email.indexOf('@') !== body.email.lastIndexOf('@')) {
    return corsJson({ error: 'Valid email required' }, 400, env, origin)
  }

  // Very rudimentary auth via WEEKLY_SUMMARY_TOKEN or just open for testing on local dev
  const authHeader = request.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (token !== env.WEEKLY_SUMMARY_TOKEN) {
    return corsJson({ error: 'Unauthorized' }, 401, env, origin)
  }

  const templateId = body.template === 'daily' ? env.RESEND_TEMPLATE_DAILY : env.RESEND_TEMPLATE_PACKAGE
  if (!templateId) {
    return corsJson({ error: `Template ${body.template} not configured` }, 500, env, origin)
  }

  const result = await sendResendEmail(env, templateId, body.email, body.variables || {})

  if (!result) {
    return corsJson({ error: 'Failed to send email' }, 500, env, origin)
  }

  return corsJson({ ok: true }, 200, env, origin)
}

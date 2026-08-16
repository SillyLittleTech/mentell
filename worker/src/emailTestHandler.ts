import { corsJson, corsResponse } from './cors'
import type { Env } from './env'
import { sendResendEmail, type EmailTemplateKind } from './emailSend'
import { authorizeSharedToken } from './pushHandlers'

function isValidEmail(email: string) {
  return (
    email.length > 0 &&
    email.length <= 254 &&
    email.indexOf('@') >= 1 &&
    email.indexOf('@') === email.lastIndexOf('@') &&
    email.indexOf('.') >= email.indexOf('@') + 2
  )
}

export async function handleEmailTest(request: Request, env: Env) {
  const origin = request.headers.get('Origin')
  if (request.method === 'OPTIONS') return corsResponse(null, 204, env, origin)

  if (request.method !== 'POST') {
    return corsJson({ error: 'Method not allowed' }, 405, env, origin)
  }

  let body: { email: string; template: EmailTemplateKind; variables?: Record<string, string> }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return corsJson({ error: 'Invalid JSON' }, 400, env, origin)
  }

  const email = typeof body.email === 'string' ? body.email.trim() : ''
  if (!isValidEmail(email)) {
    return corsJson({ error: 'Valid email required' }, 400, env, origin)
  }

  if (!authorizeSharedToken(request, env)) {
    return corsJson({ error: 'Unauthorized' }, 401, env, origin)
  }

  const template = body.template
  if (template !== 'daily' && template !== 'package' && template !== 'verify') {
    return corsJson({ error: 'template must be daily, package, or verify' }, 400, env, origin)
  }

  const result = await sendResendEmail(env, template, email, body.variables || {})

  if (!result.ok) {
    return corsJson({ error: result.error, status: result.status }, 502, env, origin)
  }

  return corsJson({ ok: true, id: result.id }, 200, env, origin)
}

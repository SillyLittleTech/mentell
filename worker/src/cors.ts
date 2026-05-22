export type CorsEnv = {
  ALLOWED_HOST_SUFFIXES?: string
}

const DEFAULT_HOST_SUFFIXES = ['.sillylittle.tech', '.workers.dev']

function parseExtraSuffixes(raw: string | undefined) {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.startsWith('.') ? s : `.${s}`))
}

function isLocalDevHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

function hostMatchesSuffix(hostname: string, suffix: string) {
  const bare = suffix.startsWith('.') ? suffix.slice(1) : suffix
  return hostname === bare || hostname.endsWith(suffix)
}

function isAllowedRequestOrigin(origin: string, env: CorsEnv) {
  let parsed: URL
  try {
    parsed = new URL(origin)
  } catch {
    return false
  }

  const host = parsed.hostname
  if (isLocalDevHost(host)) return true

  const suffixes = [...DEFAULT_HOST_SUFFIXES, ...parseExtraSuffixes(env.ALLOWED_HOST_SUFFIXES)]
  return suffixes.some((suffix) => hostMatchesSuffix(host, suffix))
}

function corsOrigin(env: CorsEnv, requestOrigin: string | null) {
  if (!requestOrigin) return null
  if (!isAllowedRequestOrigin(requestOrigin, env)) return null
  return requestOrigin
}

export function corsHeaders(env: CorsEnv, requestOrigin: string | null, methods = 'POST, OPTIONS') {
  const allow = corsOrigin(env, requestOrigin)
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    Vary: 'Origin',
  }
  if (allow) headers['Access-Control-Allow-Origin'] = allow
  return headers
}

export function corsResponse(
  body: BodyInit | null,
  status: number,
  env: CorsEnv,
  requestOrigin: string | null,
  methods?: string,
) {
  return new Response(body, { status, headers: corsHeaders(env, requestOrigin, methods) })
}

export function corsJson(
  payload: unknown,
  status: number,
  env: CorsEnv,
  requestOrigin: string | null,
  methods?: string,
) {
  const headers = {
    ...corsHeaders(env, requestOrigin, methods),
    'Content-Type': 'application/json',
  }
  return new Response(JSON.stringify(payload), { status, headers })
}

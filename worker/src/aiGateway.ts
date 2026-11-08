import type { Env } from './env'

/**
 * Run a Workers AI model, optionally via AI Gateway when AI_GATEWAY_ID is set.
 * Rate limits / spend limits should be configured on that gateway in the dashboard.
 * Do not put rate limits on any gateway used by AI Search indexing.
 */
export async function runWorkersAi(
  env: Env,
  model: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  const gatewayId = env.AI_GATEWAY_ID?.trim()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ai: any = env.AI
  if (gatewayId && typeof ai.gateway === 'function') {
    return ai.gateway(gatewayId).run(model, input)
  }
  return ai.run(model, input)
}

export function extractAiText(result: unknown) {
  if (typeof result === 'string') return result
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>
    if (typeof r.response === 'string') return r.response
    if (typeof r.text === 'string') return r.text
    const choices = r.choices
    if (Array.isArray(choices) && choices[0] && typeof choices[0] === 'object') {
      const msg = (choices[0] as { message?: { content?: string } }).message?.content
      if (typeof msg === 'string') return msg
    }
  }
  return ''
}

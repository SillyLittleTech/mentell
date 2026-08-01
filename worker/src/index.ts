import { handleAuthHandoffCreate, handleAuthHandoffRedeem } from './authHandoff'
import { corsJson } from './cors'
import type { Env } from './env'
import {
  handlePushStatus,
  handlePushSubscribe,
  handlePushTest,
  handlePushTestDelayed,
  handlePushUnsubscribe,
} from './pushHandlers'
import { runPushCron } from './pushCron'
import { handleProjectorSearch } from './projectorSearch'
import { handleRiskAssessment } from './riskAssessment'
import { handleWeeklySummary } from './weeklySummary'

export type { Env } from './env'

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin')

    switch (url.pathname) {
      case '/weekly-summary':
        return handleWeeklySummary(request, env)
      case '/projector-search':
        return handleProjectorSearch(request, env)
      case '/risk-assessment':
        return handleRiskAssessment(request, env)
      case '/push/subscribe':
        return handlePushSubscribe(request, env)
      case '/push/unsubscribe':
        return handlePushUnsubscribe(request, env)
      case '/push/test':
        return handlePushTest(request, env)
      case '/push/status':
        return handlePushStatus(request, env)
      case '/push/test-delayed':
        return handlePushTestDelayed(request, env, ctx)
      case '/auth/handoff/create':
        return handleAuthHandoffCreate(request, env)
      case '/auth/handoff/redeem':
        return handleAuthHandoffRedeem(request, env)
      default:
        return corsJson({ error: 'Not found' }, 404, env, origin)
    }
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runPushCron(env))
  },
}

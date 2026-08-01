export type ScoreSyncContext = {
  localTotal: number
  remoteTotal: number
  localUpdatedAt: number
  remoteUpdatedAt: number
  localEntryCount: number
  remoteEntryCount: number
}

export type ScoreConflictResolution = {
  /** Which score document should be treated as authoritative after sync. */
  winner: 'local' | 'remote'
  /** Local score looks like an unrelated fresh/test install vs an established cloud account. */
  staleLocalScore: boolean
}

/**
 * Detect a low local score from a fresh device that must not overwrite a much higher cloud score.
 * Example: desktop test install with 600 pts vs cloud account with 26,500 pts and full journal history.
 */
export function isStaleLocalScore(ctx: ScoreSyncContext): boolean {
  const { localTotal, remoteTotal, localEntryCount, remoteEntryCount } = ctx
  if (remoteTotal <= localTotal) return false
  if (remoteEntryCount <= 0) return false

  const scoreGap = remoteTotal - localTotal
  const localShare = localEntryCount / remoteEntryCount

  return (
    scoreGap >= 500 &&
    remoteTotal >= localTotal * 2 &&
    localEntryCount < Math.max(5, Math.ceil(remoteEntryCount * 0.35)) &&
    localShare < 0.35
  )
}

/**
 * Merge rule:
 * - Stale local test data never wins over established cloud.
 * - Otherwise prefer newer `updatedAt` (supports legitimate shop spends lowering score).
 * - Tie-break equal timestamps with higher total.
 */
export function resolveScoreConflict(ctx: ScoreSyncContext): ScoreConflictResolution {
  const staleLocalScore = isStaleLocalScore(ctx)

  if (staleLocalScore) {
    return { winner: 'remote', staleLocalScore: true }
  }

  if (ctx.localUpdatedAt > ctx.remoteUpdatedAt) {
    return { winner: 'local', staleLocalScore: false }
  }
  if (ctx.remoteUpdatedAt > ctx.localUpdatedAt) {
    return { winner: 'remote', staleLocalScore: false }
  }

  if (ctx.localTotal === ctx.remoteTotal) {
    return { winner: 'remote', staleLocalScore: false }
  }

  return {
    winner: ctx.localTotal > ctx.remoteTotal ? 'local' : 'remote',
    staleLocalScore: false,
  }
}

export function shouldApplyRemoteScore(
  ctx: ScoreSyncContext,
  resolution: ScoreConflictResolution = resolveScoreConflict(ctx),
): boolean {
  return resolution.winner === 'remote'
}

export function shouldPushLocalScore(
  ctx: ScoreSyncContext,
  resolution: ScoreConflictResolution = resolveScoreConflict(ctx),
): boolean {
  if (resolution.staleLocalScore) return false
  return resolution.winner === 'local'
}

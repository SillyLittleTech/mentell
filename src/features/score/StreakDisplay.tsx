import { useEffect, useState, type CSSProperties } from 'react'
import {
  getStreakFireLevel,
  getStreakFlameCount,
  streakFlickerDuration,
} from './streakFireLevel'
import { MaterialIcon } from '../../components/MaterialIcon'

const FLAME_OFFSETS = [
  { top: -6, right: 6 },
  { top: -4, right: 22 },
  { top: 2, right: -2 },
] as const

export function StreakDisplay({
  streak,
  variant = 'chip',
  reducedMotion = false,
  pulse = false,
  outcomeAnimation,
}: {
  streak: number
  variant?: 'chip' | 'card'
  reducedMotion?: boolean
  pulse?: boolean
  outcomeAnimation?:
    | { kind: 'break'; key: number; from: number }
    | { kind: 'freeze'; key: number; previousFreezes: number; nextFreezes: number }
    | null
}) {
  const [breakState, setBreakState] = useState<'idle' | 'cracking' | 'zero'>('idle')
  const [breakDisplayStreak, setBreakDisplayStreak] = useState(streak)
  const breakAnimation = outcomeAnimation?.kind === 'break' ? outcomeAnimation : null
  const freezeAnimation = outcomeAnimation?.kind === 'freeze' ? outcomeAnimation : null

  useEffect(() => {
    if (!breakAnimation || reducedMotion || variant !== 'chip') {
      return
    }

    const startTimer = window.setTimeout(() => {
      setBreakDisplayStreak(Math.max(0, breakAnimation.from))
      setBreakState('cracking')
    }, 0)
    const zeroTimer = window.setTimeout(() => {
      setBreakDisplayStreak(0)
      setBreakState('zero')
    }, 320)
    const doneTimer = window.setTimeout(() => {
      setBreakState('idle')
      setBreakDisplayStreak(streak)
    }, 1050)

    return () => {
      window.clearTimeout(startTimer)
      window.clearTimeout(zeroTimer)
      window.clearTimeout(doneTimer)
    }
  }, [breakAnimation, reducedMotion, streak, variant])

  const isBreaking = breakState !== 'idle'
  const isFreezing = Boolean(freezeAnimation && !reducedMotion && variant === 'chip')
  const visualStreak = isBreaking ? breakDisplayStreak : streak
  const level = getStreakFireLevel(streak)
  const displayLevel = pulse && !reducedMotion ? Math.min(6, level + 1) : level
  const breakLevel = getStreakFireLevel(breakAnimation?.from ?? streak)
  const visualLevel = isBreaking ? breakLevel : displayLevel
  const flameCount = getStreakFlameCount(visualLevel)
  const flickerSec = streakFlickerDuration(visualLevel)

  const chipClass = [
    'streak-chip',
    variant === 'chip' ? 'rounded-2xl border border-[var(--paper-border)] px-3 py-2' : '',
    variant === 'card' ? 'rounded-3xl border border-[var(--paper-border)] p-4 sm:p-5' : '',
    pulse && !reducedMotion ? 'streak-chip--pulse' : '',
    isBreaking ? 'streak-chip--breaking' : '',
    isFreezing ? 'streak-chip--freezing' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const numberClass = [
    'streak-number',
    `streak-number--level-${visualLevel}`,
    breakState === 'cracking' ? 'streak-number--cracking' : '',
    breakState === 'zero' ? 'streak-number--broken-zero' : '',
    variant === 'chip' ? 'font-mono text-lg font-bold' : 'font-mono text-2xl font-black sm:text-3xl md:text-4xl',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={chipClass}
      data-streak-level={String(visualLevel)}
      style={
        !reducedMotion && flameCount > 0
          ? ({ '--streak-flicker-duration': `${flickerSec}s` } as CSSProperties)
          : undefined
      }
    >
      {variant === 'card' ? (
        <>
          <div className="ink-muted text-xs sm:text-sm">Current streak</div>
          <div className="mt-2">
            <span className={numberClass}>{visualStreak}</span>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <MaterialIcon name="whatshot" size={18} accent={false} className="opacity-70" />
          <span className={numberClass}>{visualStreak}</span>
        </div>
      )}

      {flameCount > 0
        ? FLAME_OFFSETS.slice(0, flameCount).map((pos, i) => (
            <span
              key={i}
              className={`streak-flame streak-flame--${i + 1} ${
                reducedMotion ? '' : 'streak-flame--animated'
              }`}
              style={pos}
              aria-hidden
            >
              🔥
            </span>
          ))
        : null}

      {visualLevel >= 3 && visualLevel < 4 ? (
        <span className="streak-spark" aria-hidden>
          ✨
        </span>
      ) : null}
    </div>
  )
}

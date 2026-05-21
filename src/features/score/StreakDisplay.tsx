import type { CSSProperties } from 'react'
import {
  getStreakFireLevel,
  getStreakFlameCount,
  streakFlickerDuration,
} from './streakFireLevel'

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
}: {
  streak: number
  variant?: 'chip' | 'card'
  reducedMotion?: boolean
  pulse?: boolean
}) {
  const level = getStreakFireLevel(streak)
  const displayLevel = pulse && !reducedMotion ? Math.min(6, level + 1) : level
  const flameCount = getStreakFlameCount(displayLevel)
  const flickerSec = streakFlickerDuration(displayLevel)

  const chipClass = [
    'streak-chip',
    variant === 'chip' ? 'rounded-2xl border border-[var(--paper-border)] px-3 py-2' : '',
    variant === 'card' ? 'rounded-3xl border border-[var(--paper-border)] p-5' : '',
    pulse && !reducedMotion ? 'streak-chip--pulse' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const numberClass = [
    'streak-number',
    `streak-number--level-${displayLevel}`,
    variant === 'chip' ? 'font-mono text-lg font-bold' : 'font-mono text-4xl font-black',
  ].join(' ')

  return (
    <div
      className={chipClass}
      data-streak-level={String(displayLevel)}
      style={
        !reducedMotion && flameCount > 0
          ? ({ '--streak-flicker-duration': `${flickerSec}s` } as CSSProperties)
          : undefined
      }
    >
      {variant === 'card' ? (
        <div className="ink-muted text-sm">Current streak</div>
      ) : (
        <div className="font-mono text-[11px] uppercase opacity-70">streak</div>
      )}
      <div className={variant === 'card' ? 'mt-2' : ''}>
        <span className={numberClass}>{streak}</span>
      </div>
      {flameCount > 0
        ? FLAME_OFFSETS.slice(0, flameCount).map((pos, i) => (
            <span
              key={i}
              className={`streak-flame streak-flame--${i + 1} ${reducedMotion ? '' : 'streak-flame--animated'}`}
              style={pos}
              aria-hidden
            >
              🔥
            </span>
          ))
        : null}
      {displayLevel >= 3 && displayLevel < 4 ? (
        <span className="streak-spark" aria-hidden>
          ✨
        </span>
      ) : null}
    </div>
  )
}

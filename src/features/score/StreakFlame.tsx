const WARM_THRESHOLD = 3
const FIRE_THRESHOLD = 7

export function StreakFlame({
  streak,
  reducedMotion,
  pulse,
}: {
  streak: number
  reducedMotion: boolean
  pulse?: boolean
}) {
  const warm = streak >= WARM_THRESHOLD
  const fire = streak >= FIRE_THRESHOLD

  const chipClass = [
    'streak-chip rounded-2xl border border-[var(--paper-border)] px-3 py-2',
    warm ? 'streak-chip--warm' : '',
    fire ? 'streak-chip--fire' : '',
    pulse && !reducedMotion ? 'streak-chip--warm' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={chipClass}>
      <div className="font-mono text-[11px] uppercase opacity-70">streak</div>
      <div className="font-mono text-lg font-bold">{streak}</div>
      {fire ? (
        <span
          className={`streak-flame ${reducedMotion ? '' : 'streak-flame--animated'}`}
          aria-hidden
        >
          🔥
        </span>
      ) : null}
    </div>
  )
}

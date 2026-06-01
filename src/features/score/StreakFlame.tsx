import { StreakDisplay } from './StreakDisplay'

export function StreakFlame({
  streak,
  reducedMotion,
  pulse,
  outcomeAnimation,
}: {
  streak: number
  reducedMotion: boolean
  pulse?: boolean
  outcomeAnimation?:
    | { kind: 'break'; key: number; from: number }
    | { kind: 'freeze'; key: number; previousFreezes: number; nextFreezes: number }
    | null
}) {
  return (
    <StreakDisplay
      streak={streak}
      variant="chip"
      reducedMotion={reducedMotion}
      pulse={pulse}
      outcomeAnimation={outcomeAnimation}
    />
  )
}

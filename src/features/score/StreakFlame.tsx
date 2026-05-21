import { StreakDisplay } from './StreakDisplay'

export function StreakFlame({
  streak,
  reducedMotion,
  pulse,
}: {
  streak: number
  reducedMotion: boolean
  pulse?: boolean
}) {
  return (
    <StreakDisplay
      streak={streak}
      variant="chip"
      reducedMotion={reducedMotion}
      pulse={pulse}
    />
  )
}

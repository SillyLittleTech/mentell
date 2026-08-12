import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUnopenedPackages, iconLevelForPackages, markPackageOpened } from './packageService'
import { TruckDrop } from './TruckDrop'
import type { PackageRow } from '../../db/schema'
import { getForcePackages, isDebugMode } from '../../shared/debug/debugFlags'
import { motionDuration, shouldReduceMotion } from '../../shared/motion/useMotionPrefs'
import { MaterialIcon } from '../../components/MaterialIcon'

export function PackageAlert({
  onAward,
  placement = 'floating',
  size = 'md',
}: {
  onAward: (delta: number, hint: string | null) => void
  placement?: 'floating' | 'inline'
  size?: 'sm' | 'md' | 'lg'
}) {
  const [pkgs, setPkgs] = useState<PackageRow[]>([])
  const [truck, setTruck] = useState(false)
  const prevLevelRef = useRef(0)
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
    const tick = async () => {
      const unopened = await getUnopenedPackages()
      if (!mounted) return
      const prevLevel = prevLevelRef.current
      const nextLevel = iconLevelForPackages(unopened)
      setPkgs(unopened)
      if (nextLevel > prevLevel && nextLevel > 0) {
        setTruck(true)
        setTimeout(() => setTruck(false), 1200)
      }
      prevLevelRef.current = nextLevel
    }

    tick()
    const id = window.setInterval(tick, 1800)
    return () => {
      mounted = false
      window.clearInterval(id)
    }
  }, [])

  const count = pkgs.length

  const kindCounts = useMemo(() => {
    const counts: Record<string, number> = { weekly: 0, monthly: 0, yearly: 0 }
    for (const p of pkgs) counts[p.kind] = (counts[p.kind] ?? 0) + 1
    return counts as { weekly: number; monthly: number; yearly: number }
  }, [pkgs])

  const rewardKind: 'weekly' | 'monthly' | 'yearly' | null =
    kindCounts.yearly > 0
      ? 'yearly'
      : kindCounts.monthly > 0
        ? 'monthly'
        : kindCounts.weekly > 0
          ? 'weekly'
          : null

  // Keep the existing "truck" animation trigger semantics based on icon level,
  // but render a kind-specific present icon instead of gift PNGs.
  const level = useMemo(() => iconLevelForPackages(pkgs), [pkgs])

  const forced = isDebugMode() && getForcePackages()
  if (level === 0 && !forced) return null

  const presentColorClass =
    rewardKind === 'yearly'
      ? 'text-[var(--danger)]'
      : rewardKind === 'monthly'
        ? 'text-[var(--primary-action)]'
        : 'text-[var(--success)]'

  const dims =
    placement === 'floating'
      ? { outer: 'h-12 w-12', img: 'h-10 w-10', padX: 'px-4', padY: 'py-3' }
      : size === 'sm'
        ? { outer: 'h-10 w-10', img: 'h-8 w-8', padX: 'px-3', padY: 'py-2' }
        : size === 'lg'
          ? { outer: 'h-12 w-12', img: 'h-10 w-10', padX: 'px-4', padY: 'py-3' }
          : { outer: 'h-11 w-11', img: 'h-9 w-9', padX: 'px-4', padY: 'py-3' }

  return (
    <div
      className={placement === 'floating' ? 'fixed bottom-5 right-5 z-30' : 'relative z-10'}
    >
      <div className="relative">
        <AnimatePresence>{truck ? <TruckDrop /> : null}</AnimatePresence>

        <motion.button
          type="button"
          className={`focus-ring paper flex items-center gap-3 rounded-3xl ${
            placement === 'inline' ? `${dims.padX} ${dims.padY}` : 'px-4 py-3'
          }`}
          initial={shouldReduceMotion() ? false : { scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={shouldReduceMotion() ? undefined : { scale: 1.03 }}
          whileTap={shouldReduceMotion() ? undefined : { scale: 0.98 }}
          transition={{ duration: motionDuration(0.25) || 0 }}
          onClick={async () => {
            const first = pkgs[0]
            if (first) {
              const res = await markPackageOpened(first.id)
              if (res.awarded) onAward(res.delta, res.hint)
            }
            navigate('/week')
          }}
        >
          <div
            className={`relative flex items-center justify-center rounded-2xl border border-[var(--paper-border)] ${
              placement === 'inline' ? dims.outer : 'h-12 w-12'
            }`}
          >
            <MaterialIcon
              name="card_giftcard"
              accent={false}
              className={`${placement === 'inline' ? 'opacity-90' : 'opacity-95'} ${presentColorClass}`}
              size={placement === 'inline' ? 22 : 24}
            />
          </div>
          <div className="text-left">
            <div className="font-medium">New package</div>
            <div className="ink-muted text-sm">
              {forced && count === 0 ? 'debug mode' : `${count} waiting`}
            </div>
          </div>
        </motion.button>
      </div>
    </div>
  )
}


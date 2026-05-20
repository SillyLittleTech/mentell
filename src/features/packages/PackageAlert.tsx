import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUnopenedPackages, iconLevelForPackages, markPackageOpened } from './packageService'
import { TruckDrop } from './TruckDrop'
import type { PackageRow } from '../../db/schema'
import { getForcePackages, isDebugMode } from '../../shared/debug/debugFlags'

export function PackageAlert({
  onAward,
}: {
  onAward: (delta: number, hint: string | null) => void
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

  const level = useMemo(() => iconLevelForPackages(pkgs), [pkgs])
  const count = pkgs.length

  const forced = isDebugMode() && getForcePackages()
  if (level === 0 && !forced) return null

  const icon =
    level >= 3 ? '/asset/gift_large.png' : level === 2 ? '/asset/gift_med.png' : '/asset/gift_small.png'

  return (
    <div className="fixed bottom-5 right-5 z-30">
      <div className="relative">
        <AnimatePresence>{truck ? <TruckDrop /> : null}</AnimatePresence>

        <motion.button
          type="button"
          className="focus-ring paper flex items-center gap-3 rounded-3xl px-4 py-3"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          onClick={async () => {
            const first = pkgs[0]
            if (first) {
              const res = await markPackageOpened(first.id)
              if (res.awarded) onAward(res.delta, res.hint)
            }
            navigate('/week')
          }}
        >
          <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--paper-border)]">
            <img alt="" src={icon} className="h-10 w-10 select-none object-contain" draggable={false} />
          </div>
          <div className="text-left">
            <div className="font-medium">New package</div>
            <div className="ink-muted text-sm">{forced && count === 0 ? 'debug mode' : `${count} waiting`}</div>
          </div>
        </motion.button>
      </div>
    </div>
  )
}


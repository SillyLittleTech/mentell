import { useEffect } from 'react'
import { shouldReduceMotion } from '../../shared/motion/useMotionPrefs'

/**
 * Updates `--spot-x` / `--spot-y` CSS vars to create a cursor-following dot highlight.
 * Visual-only: doesn't affect layout and is disabled for reduced motion / coarse pointers.
 */
export function DeskSpotlight() {
  useEffect(() => {
    if (shouldReduceMotion()) return
    const pointerFine = window.matchMedia?.('(pointer:fine)')?.matches
    if (!pointerFine) return

    let raf = 0
    let latestX = 0
    let latestY = 0

    const apply = () => {
      raf = 0
      document.documentElement.style.setProperty('--spot-x', `${latestX}px`)
      document.documentElement.style.setProperty('--spot-y', `${latestY}px`)
    }

    const onMove = (event: PointerEvent) => {
      latestX = event.clientX
      latestY = event.clientY
      if (raf) return
      raf = window.requestAnimationFrame(apply)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [])

  return null
}


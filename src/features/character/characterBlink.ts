import { useEffect } from 'react'
import { charManifest } from './charManifest'
import { shouldReduceMotion } from '../../shared/motion/useMotionPrefs'

function setLayerVisible(svg: SVGSVGElement, id: string, show: boolean) {
  const el = svg.getElementById(id)
  if (!(el instanceof SVGElement)) return
  el.style.display = show ? 'inline' : 'none'
}

function blinkLayerIds(svg: SVGSVGElement) {
  const openLayerIds = new Set<string>(charManifest.blink?.openLayerIds ?? [])
  const closedLayerIds = new Set<string>(
    charManifest.blink ? [charManifest.blink.closedLayerId] : [],
  )
  svg.querySelectorAll<SVGElement>('*').forEach((el) => {
    const label = el.getAttribute('inkscape:label') ?? ''
    if (!el.id) return
    if (label === 'BLK') closedLayerIds.add(el.id)
    else if (label.endsWith('_BLK')) openLayerIds.add(el.id)
  })
  return { openLayerIds: [...openLayerIds], closedLayerIds: [...closedLayerIds] }
}

/** Default: open-eye *_BLK layers on, closed-eye BLK layer off. */
export function applyBlinkOpenState(svg: SVGSVGElement) {
  const { openLayerIds, closedLayerIds } = blinkLayerIds(svg)
  for (const id of openLayerIds) setLayerVisible(svg, id, true)
  for (const id of closedLayerIds) setLayerVisible(svg, id, false)
}

/** Blink frame: hide *_BLK, show BLK overlay. */
export function applyBlinkClosedState(svg: SVGSVGElement) {
  const { openLayerIds, closedLayerIds } = blinkLayerIds(svg)
  for (const id of openLayerIds) setLayerVisible(svg, id, false)
  for (const id of closedLayerIds) setLayerVisible(svg, id, true)
}

export function useCharacterBlink(
  svgRef: React.RefObject<SVGSVGElement | null>,
  svgGeneration = 0,
) {
  useEffect(() => {
    if (svgGeneration < 0) return
    const blink = charManifest.blink
    if (!blink || shouldReduceMotion()) return

    const svg = svgRef.current
    if (!svg) return

    let cancelled = false
    let intervalTimer: ReturnType<typeof setTimeout> | undefined
    let closeTimer: ReturnType<typeof setTimeout> | undefined

    const scheduleNext = () => {
      const wait =
        blink.minIntervalMs +
        Math.random() * (blink.maxIntervalMs - blink.minIntervalMs)
      intervalTimer = setTimeout(() => {
        if (cancelled) return
        applyBlinkClosedState(svg)
        closeTimer = setTimeout(() => {
          if (cancelled) return
          applyBlinkOpenState(svg)
          scheduleNext()
        }, blink.closedDurationMs)
      }, wait)
    }

    applyBlinkOpenState(svg)
    scheduleNext()

    return () => {
      cancelled = true
      if (intervalTimer !== undefined) clearTimeout(intervalTimer)
      if (closeTimer !== undefined) clearTimeout(closeTimer)
      applyBlinkOpenState(svg)
    }
  }, [svgRef, svgGeneration])
}

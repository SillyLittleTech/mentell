import { useEffect } from 'react'
import { charManifest } from './charManifest'
import { shouldReduceMotion } from '../../shared/motion/useMotionPrefs'

type BlinkLayers = {
  openLayerIds: string[]
  closedLayerIds: string[]
}

const blinkLayerCache = new WeakMap<SVGSVGElement, BlinkLayers>()

function setLayerVisible(svg: SVGSVGElement, id: string, show: boolean) {
  const el = svg.getElementById(id)
  if (!(el instanceof SVGElement)) return
  el.style.display = show ? 'inline' : 'none'
}

function blinkLayerIds(svg: SVGSVGElement): BlinkLayers {
  const cached = blinkLayerCache.get(svg)
  if (cached) return cached

  const openLayerIds = [...(charManifest.blink?.openLayerIds ?? [])].filter((id) =>
    Boolean(svg.getElementById(id)),
  )
  const closedFromManifest = [...(charManifest.blink?.closedLayerIds ?? [])]
  const closedLayerIds = closedFromManifest.filter((id) => Boolean(svg.getElementById(id)))

  const ids = { openLayerIds, closedLayerIds }
  blinkLayerCache.set(svg, ids)
  return ids
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
  svgGeneration: number | string = 0,
  forceClosed = false,
) {
  useEffect(() => {
    if (svgGeneration === -1) return

    const svg = svgRef.current
    if (!svg) return

    if (forceClosed) {
      applyBlinkClosedState(svg)
      return () => {
        applyBlinkOpenState(svg)
      }
    }

    const blink = charManifest.blink
    if (!blink || shouldReduceMotion()) return

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
  }, [svgRef, svgGeneration, forceClosed])
}

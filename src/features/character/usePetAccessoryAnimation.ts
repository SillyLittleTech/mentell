import { useEffect } from 'react'
import { shouldReduceMotion } from '../../shared/motion/useMotionPrefs'

const BASE_TRANSFORM_ATTR = 'data-mentell-pet-base-transform'

type TailNode = {
  el: SVGGraphicsElement
  baseTransform: string
  pivot: { cx: number; cy: number }
  kind: 'cat' | 'dog'
}

function getBaseTransform(el: SVGGraphicsElement) {
  const stored = el.getAttribute(BASE_TRANSFORM_ATTR)
  if (stored !== null) return stored
  const initial = el.getAttribute('transform') ?? ''
  el.setAttribute(BASE_TRANSFORM_ATTR, initial)
  return initial
}

function isRendered(el: SVGGraphicsElement) {
  return getComputedStyle(el).display !== 'none'
}

function petKind(el: Element): 'cat' | 'dog' | null {
  let current: Element | null = el
  while (current) {
    const label = (current.getAttribute('inkscape:label') ?? '').toLowerCase()
    if (label.includes('catbase')) return 'cat'
    if (label.includes('dogbase')) return 'dog'
    current = current.parentElement
  }
  return null
}

function collectTailNodes(svg: SVGSVGElement) {
  return Array.from(svg.querySelectorAll<SVGGraphicsElement>('[inkscape\\:label="tail"]'))
    .filter((el) => el instanceof SVGGraphicsElement && isRendered(el))
    .map((el): TailNode | null => {
      const kind = petKind(el)
      if (!kind) return null
      const box = el.getBBox()
      return {
        el,
        baseTransform: getBaseTransform(el),
        pivot: { cx: box.x + box.width / 2, cy: box.y + box.height / 2 },
        kind,
      }
    })
    .filter((node): node is TailNode => node !== null)
}

export function usePetAccessoryAnimation(
  svgRef: React.RefObject<SVGSVGElement | null>,
  svgGeneration: number | string = 0,
) {
  useEffect(() => {
    if (svgGeneration === -1) return undefined
    const svg = svgRef.current
    if (!svg || shouldReduceMotion()) return undefined

    const tails = collectTailNodes(svg)
    if (!tails.length) return undefined

    let raf = 0
    const start = performance.now()

    const tick = (now: number) => {
      const elapsed = now - start
      for (const node of tails) {
        const amplitude = node.kind === 'dog' ? 12 : 4
        const speed = node.kind === 'dog' ? 0.018 : 0.0045
        const deg = Math.sin(elapsed * speed) * amplitude
        const rotate = `rotate(${deg.toFixed(3)} ${node.pivot.cx} ${node.pivot.cy})`
        node.el.setAttribute(
          'transform',
          node.baseTransform ? `${node.baseTransform} ${rotate}` : rotate,
        )
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      for (const node of tails) {
        node.el.setAttribute('transform', node.baseTransform)
      }
    }
  }, [svgRef, svgGeneration])
}

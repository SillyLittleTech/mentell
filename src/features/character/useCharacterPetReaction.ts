import { animate } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { charManifest } from './charManifest'
import { motionDuration, shouldReduceMotion } from '../../shared/motion/useMotionPrefs'

const HEAD_LAYER_IDS = ['layer16', 'layer14', 'layer17', 'layer18', 'g100', 'g102'] as const
const BASE_TRANSFORM_ATTR = 'data-mentell-head-base-transform'

type HeadNode = {
  el: SVGGraphicsElement
  baseTransform: string
  pivot: { cx: number; cy: number }
}

function getBaseTransform(el: SVGGraphicsElement) {
  const stored = el.getAttribute(BASE_TRANSFORM_ATTR)
  if (stored !== null) return stored
  const initial = el.getAttribute('transform') ?? ''
  el.setAttribute(BASE_TRANSFORM_ATTR, initial)
  return initial
}

function elementPointToSvg(
  el: SVGGraphicsElement,
  local: { cx: number; cy: number },
): { cx: number; cy: number } {
  const svg = el.ownerSVGElement
  const elementMatrix = el.getScreenCTM()
  const svgMatrix = svg?.getScreenCTM()
  if (!svg || !elementMatrix || !svgMatrix) return local
  const pt = svg.createSVGPoint()
  pt.x = local.cx
  pt.y = local.cy
  const asScreen = pt.matrixTransform(elementMatrix)
  const asSvg = asScreen.matrixTransform(svgMatrix.inverse())
  return { cx: asSvg.x, cy: asSvg.y }
}

function svgPointToElement(
  el: SVGGraphicsElement,
  svgPoint: { cx: number; cy: number },
): { cx: number; cy: number } {
  const svg = el.ownerSVGElement
  const elementMatrix = el.getScreenCTM()
  const svgMatrix = svg?.getScreenCTM()
  if (!svg || !elementMatrix || !svgMatrix) return svgPoint
  const pt = svg.createSVGPoint()
  pt.x = svgPoint.cx
  pt.y = svgPoint.cy
  const asScreen = pt.matrixTransform(svgMatrix)
  const asElement = asScreen.matrixTransform(elementMatrix.inverse())
  return { cx: asElement.x, cy: asElement.y }
}

function closedBlinkIds() {
  const blink = charManifest.blink
  if (!blink) return []
  return [...blink.closedLayerIds]
}

function collectHeadNodes(svg: SVGSVGElement): HeadNode[] {
  const face = svg.getElementById('layer14')
  let pivotSvg = { cx: 115, cy: 175 }
  if (face instanceof SVGGraphicsElement) {
    try {
      const box = face.getBBox()
      pivotSvg = elementPointToSvg(face, {
        cx: box.x + box.width / 2,
        cy: box.y + box.height * 0.85,
      })
    } catch {
      // Keep the authored neck fallback.
    }
  }

  const ids = [...HEAD_LAYER_IDS, ...closedBlinkIds()]
  const nodes: HeadNode[] = []
  const seen = new Set<SVGGraphicsElement>()
  for (const id of ids) {
    const el = svg.getElementById(id)
    if (!(el instanceof SVGGraphicsElement) || seen.has(el)) continue
    seen.add(el)
    nodes.push({
      el,
      baseTransform: getBaseTransform(el),
      pivot: svgPointToElement(el, pivotSvg),
    })
  }
  return nodes
}

function applyHeadRotate(nodes: HeadNode[], deg: number) {
  for (const node of nodes) {
    const rotate = `rotate(${deg} ${node.pivot.cx} ${node.pivot.cy})`
    node.el.setAttribute(
      'transform',
      node.baseTransform ? `${node.baseTransform} ${rotate}` : rotate,
    )
  }
}

export function useCharacterPetReaction(
  svgRef: React.RefObject<SVGSVGElement | null>,
  svgGeneration: number | string,
  trigger: number,
) {
  const lastTrigger = useRef(0)

  useEffect(() => {
    if (svgGeneration === -1 || trigger <= 0 || trigger === lastTrigger.current) return
    lastTrigger.current = trigger

    const svg = svgRef.current
    if (!svg || shouldReduceMotion()) return

    const nodes = collectHeadNodes(svg)
    if (!nodes.length) return

    const duration = motionDuration(0.42)
    if (duration === 0) return

    const controls = animate(0, 1, {
      duration,
      ease: 'easeOut',
      onUpdate: (t) => {
        const deg = Math.sin(t * Math.PI * 4) * 7.5 * (1 - t)
        applyHeadRotate(nodes, deg)
      },
      onComplete: () => applyHeadRotate(nodes, 0),
    })

    return () => {
      controls.stop()
      applyHeadRotate(nodes, 0)
    }
  }, [svgRef, svgGeneration, trigger])
}

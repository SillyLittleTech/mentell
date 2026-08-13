import { animate } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { charManifest } from './charManifest'
import type { ArmPose } from './characterPoses'
import { motionDuration } from '../../shared/motion/useMotionPrefs'

function shoulderPivot(joint: SVGGElement): { cx: number; cy: number } {
  const path = joint.querySelector('path')
  if (path) {
    try {
      const point = path.getPointAtLength(0)
      if (Number.isFinite(point.x) && Number.isFinite(point.y)) {
        return { cx: point.x, cy: point.y }
      }
    } catch {
      // Fall through to the geometric fallback below.
    }
  }
  const box = joint.getBBox()
  return { cx: box.x + box.width / 2, cy: box.y }
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

type RotatingNode = {
  el: SVGGraphicsElement
  baseTransform: string
  pivot: { cx: number; cy: number }
}

type PoseNodeCache = {
  generation: number | string
  apply: (degL: number, degR: number) => void
}

const BASE_TRANSFORM_ATTR = 'data-mentell-base-transform'

function getBaseTransform(el: SVGGraphicsElement) {
  const stored = el.getAttribute(BASE_TRANSFORM_ATTR)
  if (stored !== null) return stored
  const initial = el.getAttribute('transform') ?? ''
  el.setAttribute(BASE_TRANSFORM_ATTR, initial)
  return initial
}

function setRotateWithBase(node: RotatingNode, deg: number) {
  const rotate = `rotate(${deg} ${node.pivot.cx} ${node.pivot.cy})`
  node.el.setAttribute(
    'transform',
    node.baseTransform ? `${node.baseTransform} ${rotate}` : rotate,
  )
}

function isRendered(el: SVGGraphicsElement) {
  if (el.style.display === 'none') return false
  const attr = el.getAttribute('style')
  return !attr || !/\bdisplay\s*:\s*none\b/.test(attr)
}

function normalizeLookup(value: string) {
  return value
    .toLowerCase()
    .replace(/_(toggle|iii|dni).*$/i, '')
    .replace(/[^a-z0-9]+/g, '')
}

function resolveGraphics(svg: SVGSVGElement, key: string) {
  const byId = svg.getElementById(key)
  if (byId instanceof SVGGraphicsElement) return [byId]
  const normalized = normalizeLookup(key)
  return elementsWithInkscapeLabel(svg, key).filter((el) => {
    const label = el.getAttribute('inkscape:label') ?? ''
    return normalizeLookup(label) === normalized
  })
}

function elementsWithInkscapeLabel(root: ParentNode, label: string): SVGGraphicsElement[] {
  const hits: SVGGraphicsElement[] = []
  root.querySelectorAll('g, path').forEach((node) => {
    if (!(node instanceof SVGGraphicsElement)) return
    if (node.getAttribute('inkscape:label') === label) hits.push(node)
  })
  return hits
}

function extraArmJoints(
  svg: SVGSVGElement,
  label: 'armL_joint' | 'armR_joint',
  mainJoint: SVGGraphicsElement,
  svgPivot: { cx: number; cy: number },
): RotatingNode[] {
  const nodes: RotatingNode[] = []
  for (const el of elementsWithInkscapeLabel(svg, label)) {
    if (el === mainJoint) continue
    const baseTransform = getBaseTransform(el)
    el.setAttribute('transform', baseTransform)
    nodes.push({
      el,
      baseTransform,
      pivot: svgPointToElement(el, svgPivot),
    })
  }
  return nodes
}

function buildPoseNodes(
  svg: SVGSVGElement,
  anchoredIds?: { armL?: readonly string[]; armR?: readonly string[] },
): PoseNodeCache['apply'] | null {
  const armL = svg.getElementById(charManifest.arms.armL.jointId) as SVGGElement | null
  const armR = svg.getElementById(charManifest.arms.armR.jointId) as SVGGElement | null
  if (!armL || !armR) return null

  const armLBase = getBaseTransform(armL)
  const armRBase = getBaseTransform(armR)
  armL.setAttribute('transform', armLBase)
  armR.setAttribute('transform', armRBase)

  const pivotLLocal = shoulderPivot(armL)
  const pivotRLocal = shoulderPivot(armR)
  const pivotL = elementPointToSvg(armL, pivotLLocal)
  const pivotR = elementPointToSvg(armR, pivotRLocal)

  const armLNode: RotatingNode = {
    el: armL,
    baseTransform: armLBase,
    pivot: pivotLLocal,
  }
  const armRNode: RotatingNode = {
    el: armR,
    baseTransform: armRBase,
    pivot: pivotRLocal,
  }
  const shadowLNodes = extraArmJoints(svg, 'armL_joint', armL, pivotL)
  const shadowRNodes = extraArmJoints(svg, 'armR_joint', armR, pivotR)

  const leftSleeveIds = [
    ...charManifest.arms.armL.sleeveIds,
    ...(anchoredIds?.armL ?? []),
  ]
  const rightSleeveIds = [
    ...charManifest.arms.armR.sleeveIds,
    ...(anchoredIds?.armR ?? []),
  ]

  const leftSleeves = leftSleeveIds
    .flatMap((id) => resolveGraphics(svg, id))
    .filter((el): el is SVGGraphicsElement => el instanceof SVGGraphicsElement && isRendered(el))
  const rightSleeves = rightSleeveIds
    .flatMap((id) => resolveGraphics(svg, id))
    .filter((el): el is SVGGraphicsElement => el instanceof SVGGraphicsElement && isRendered(el))

  const leftSleeveNodes: RotatingNode[] = leftSleeves.map((el) => {
    const baseTransform = getBaseTransform(el)
    el.setAttribute('transform', baseTransform)
    return {
      el,
      baseTransform,
      pivot: svgPointToElement(el, pivotL),
    }
  })
  const rightSleeveNodes: RotatingNode[] = rightSleeves.map((el) => {
    const baseTransform = getBaseTransform(el)
    el.setAttribute('transform', baseTransform)
    return {
      el,
      baseTransform,
      pivot: svgPointToElement(el, pivotR),
    }
  })

  return (degL: number, degR: number) => {
    setRotateWithBase(armLNode, degL)
    setRotateWithBase(armRNode, degR)
    for (const node of shadowLNodes) setRotateWithBase(node, degL)
    for (const node of shadowRNodes) setRotateWithBase(node, degR)
    for (const node of leftSleeveNodes) setRotateWithBase(node, degL)
    for (const node of rightSleeveNodes) setRotateWithBase(node, degR)
  }
}

export function useArmPoseAnimation(
  svgRef: React.RefObject<SVGSVGElement | null>,
  pose: ArmPose,
  svgGeneration: number | string = 0,
  anchoredIds?: { armL?: readonly string[]; armR?: readonly string[] },
) {
  const prevPose = useRef(pose)
  const cache = useRef<PoseNodeCache | null>(null)

  useEffect(() => {
    prevPose.current = { armL: 0, armR: 0 }
    cache.current = null
  }, [svgGeneration])

  useEffect(() => {
    if (svgGeneration === -1) return
    const svg = svgRef.current
    if (!svg) return
    const nextPose: ArmPose = { armL: pose.armL, armR: pose.armR }

    if (!cache.current || cache.current.generation !== svgGeneration) {
      const apply = buildPoseNodes(svg, anchoredIds)
      if (!apply) return
      cache.current = { generation: svgGeneration, apply }
    }

    const apply = cache.current.apply
    const duration = motionDuration(0.55)

    if (duration === 0) {
      apply(nextPose.armL, nextPose.armR)
      prevPose.current = nextPose
      return
    }

    const fromL = prevPose.current.armL
    const fromR = prevPose.current.armR
    let currentL = fromL
    let currentR = fromR

    const controlsL = animate(fromL, nextPose.armL, {
      type: 'spring',
      duration,
      bounce: 0.22,
      onUpdate: (v) => {
        currentL = v
        apply(currentL, currentR)
      },
    })
    const controlsR = animate(fromR, nextPose.armR, {
      type: 'spring',
      duration,
      bounce: 0.22,
      onUpdate: (v) => {
        currentR = v
        apply(currentL, currentR)
      },
    })

    prevPose.current = nextPose
    return () => {
      controlsL.stop()
      controlsR.stop()
    }
  }, [svgRef, pose.armL, pose.armR, svgGeneration, anchoredIds])
}

import { animate } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { charManifest } from './charManifest'
import type { ArmPose } from './characterPoses'
import { motionDuration } from '../../shared/motion/useMotionPrefs'

function shoulderPivot(el: SVGGElement): { cx: number; cy: number } {
  const box = el.getBBox()
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
  return getComputedStyle(el).display !== 'none'
}

export function useArmPoseAnimation(
  svgRef: React.RefObject<SVGSVGElement | null>,
  pose: ArmPose,
  svgGeneration = 0,
) {
  const prevPose = useRef(pose)

  useEffect(() => {
    prevPose.current = { armL: 0, armR: 0 }
  }, [svgGeneration])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const nextPose: ArmPose = { armL: pose.armL, armR: pose.armR }

    const armL = svg.getElementById(charManifest.arms.armL.jointId) as SVGGElement | null
    const armR = svg.getElementById(charManifest.arms.armR.jointId) as SVGGElement | null
    if (!armL || !armR) return

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

    const leftSleeves = charManifest.arms.armL.sleeveIds
      .map((id) => svg.getElementById(id))
      .filter((el): el is SVGGraphicsElement => el instanceof SVGGraphicsElement && isRendered(el))
    const rightSleeves = charManifest.arms.armR.sleeveIds
      .map((id) => svg.getElementById(id))
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

    const apply = (degL: number, degR: number) => {
      setRotateWithBase(armLNode, degL)
      setRotateWithBase(armRNode, degR)
      for (const node of leftSleeveNodes) {
        setRotateWithBase(node, degL)
      }
      for (const node of rightSleeveNodes) {
        setRotateWithBase(node, degR)
      }
    }

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
  }, [svgRef, pose.armL, pose.armR, svgGeneration])
}

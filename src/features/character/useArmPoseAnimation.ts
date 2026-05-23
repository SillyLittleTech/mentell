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

function setRotate(el: SVGElement, deg: number, cx: number, cy: number) {
  el.setAttribute('transform', `rotate(${deg} ${cx} ${cy})`)
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

    const armL = svg.getElementById(charManifest.arms.armL.jointId) as SVGGElement | null
    const armR = svg.getElementById(charManifest.arms.armR.jointId) as SVGGElement | null
    if (!armL || !armR) return

    const pivotLLocal = shoulderPivot(armL)
    const pivotRLocal = shoulderPivot(armR)
    const pivotL = elementPointToSvg(armL, pivotLLocal)
    const pivotR = elementPointToSvg(armR, pivotRLocal)

    const leftSleeves = charManifest.arms.armL.sleeveIds
      .map((id) => svg.getElementById(id))
      .filter((el): el is SVGGraphicsElement => el instanceof SVGGraphicsElement)
    const rightSleeves = charManifest.arms.armR.sleeveIds
      .map((id) => svg.getElementById(id))
      .filter((el): el is SVGGraphicsElement => el instanceof SVGGraphicsElement)

    const apply = (degL: number, degR: number) => {
      setRotate(armL, degL, pivotLLocal.cx, pivotLLocal.cy)
      setRotate(armR, degR, pivotRLocal.cx, pivotRLocal.cy)
      for (const el of leftSleeves) {
        const localPivot = svgPointToElement(el, pivotL)
        setRotate(el, degL, localPivot.cx, localPivot.cy)
      }
      for (const el of rightSleeves) {
        const localPivot = svgPointToElement(el, pivotR)
        setRotate(el, degR, localPivot.cx, localPivot.cy)
      }
    }

    const duration = motionDuration(0.4)

    if (duration === 0) {
      apply(pose.armL, pose.armR)
      prevPose.current = pose
      return
    }

    const fromL = prevPose.current.armL
    const fromR = prevPose.current.armR
    let currentL = fromL
    let currentR = fromR

    const controlsL = animate(fromL, pose.armL, {
      duration,
      ease: [0.4, 0, 0.2, 1],
      onUpdate: (v) => {
        currentL = v
        apply(currentL, currentR)
      },
    })
    const controlsR = animate(fromR, pose.armR, {
      duration,
      ease: [0.4, 0, 0.2, 1],
      onUpdate: (v) => {
        currentR = v
        apply(currentL, currentR)
      },
    })

    prevPose.current = pose
    return () => {
      controlsL.stop()
      controlsR.stop()
    }
  }, [svgRef, pose.armL, pose.armR, pose, svgGeneration])
}

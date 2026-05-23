import { animate } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { charManifest } from './charManifest'
import type { ArmPose } from './characterPoses'
import { motionDuration } from '../../shared/motion/useMotionPrefs'

function shoulderPivot(el: SVGGElement): { cx: number; cy: number } {
  const box = el.getBBox()
  return { cx: box.x + box.width / 2, cy: box.y }
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

    const pivotL = shoulderPivot(armL)
    const pivotR = shoulderPivot(armR)

    const leftSleeves = charManifest.arms.armL.sleeveIds
      .map((id) => svg.getElementById(id))
      .filter((el): el is SVGElement => el instanceof SVGElement)
    const rightSleeves = charManifest.arms.armR.sleeveIds
      .map((id) => svg.getElementById(id))
      .filter((el): el is SVGElement => el instanceof SVGElement)

    const apply = (degL: number, degR: number) => {
      setRotate(armL, degL, pivotL.cx, pivotL.cy)
      setRotate(armR, degR, pivotR.cx, pivotR.cy)
      for (const el of leftSleeves) setRotate(el, degL, pivotL.cx, pivotL.cy)
      for (const el of rightSleeves) setRotate(el, degR, pivotR.cx, pivotR.cy)
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

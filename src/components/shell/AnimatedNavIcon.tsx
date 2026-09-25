import { motion } from 'framer-motion'
import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { MaterialIcon } from '../MaterialIcon'
import { CharacterNavIcon } from '../../features/character/CharacterNavIcon'
import {
  NAV_LETTER_ICON,
  NAV_ICONS,
  applyReducedMotion,
  navAnimationKindForRoute,
  navMotionPlan,
  navPrimaryMaterialIcon,
  type NavAnimationKind,
  type NavMotionPhaseSpec,
} from './navIconMotion'
import { motionDuration, shouldReduceMotion } from '../../shared/motion/useMotionPrefs'

type AnimatedNavIconProps = {
  to: string
  variant: 'sidebar' | 'bottom'
  active: boolean
  size: number
  /** Increment on each nav click to replay the tab animation. */
  replayToken: number
  characterClassName?: string
}

function MaterialMotionIcon({
  name,
  size,
  accent,
  className,
  spec,
  replayKey,
}: {
  name: string
  size: number
  accent: boolean
  className?: string
  spec: NavMotionPhaseSpec
  replayKey: string
}) {
  return (
    <motion.span
      key={replayKey}
      className={`inline-flex items-center justify-center ${className ?? ''}`}
      initial={spec.initial}
      animate={spec.animate}
      transition={{
        ...spec.transition,
        duration: motionDuration((spec.transition as { duration?: number }).duration ?? 0.3),
        delay: motionDuration((spec.transition as { delay?: number }).delay ?? 0),
      }}
    >
      <MaterialIcon name={name} size={size} accent={accent} />
    </motion.span>
  )
}

function AnimatedMaterialNavIcon({
  kind,
  to,
  variant,
  active,
  size,
  replayToken,
}: {
  kind: Exclude<NavAnimationKind, 'character'>
  to: string
  variant: 'sidebar' | 'bottom'
  active: boolean
  size: number
  replayToken: number
}) {
  const reduced = shouldReduceMotion()
  const plan = useMemo(() => applyReducedMotion(navMotionPlan(kind), reduced), [kind, reduced])
  const primaryName = navPrimaryMaterialIcon(to, variant) ?? NAV_ICONS.notepad
  const [runId, setRunId] = useState(0)
  const [projectorShowMain, setProjectorShowMain] = useState(true)

  useLayoutEffect(() => {
    if (replayToken <= 0) return
    setRunId(replayToken)
    if (kind !== 'projector' || reduced) return
    setProjectorShowMain(false)
    const swapMs = plan.durationSec * (plan.swapAtRatio ?? 0.5) * 1000
    const swapTimer = window.setTimeout(() => setProjectorShowMain(true), swapMs)
    return () => window.clearTimeout(swapTimer)
  }, [replayToken, kind, reduced, plan.durationSec, plan.swapAtRatio])

  if (replayToken <= 0) {
    return <MaterialIcon name={primaryName} size={size} accent={active} className={active ? '' : 'opacity-90'} />
  }

  const accent = active
  const boxClass = 'relative inline-grid place-items-center overflow-hidden'
  const boxStyle = { width: size + 6, height: size + 6 }

  if (kind === 'envelope' && plan.letter && plan.primary) {
    return (
      <span className={boxClass} style={boxStyle}>
        <MaterialMotionIcon
          key={`letter-${runId}`}
          replayKey={`letter-${runId}`}
          name={NAV_LETTER_ICON}
          size={size}
          accent={accent}
          className="absolute inset-0"
          spec={plan.letter}
        />
        <MaterialMotionIcon
          key={`primary-${runId}`}
          replayKey={`primary-${runId}`}
          name={primaryName}
          size={size}
          accent={accent}
          className="absolute inset-0"
          spec={plan.primary}
        />
      </span>
    )
  }

  if (kind === 'projector' && plan.book && plan.primary) {
    const iconName = projectorShowMain ? NAV_ICONS.projector : NAV_ICONS.projectorBook
    const spec = projectorShowMain ? plan.primary : plan.book
    return (
      <span className={boxClass} style={boxStyle}>
        <MaterialMotionIcon
          key={`projector-${runId}-${projectorShowMain ? 'main' : 'book'}`}
          replayKey={`projector-${runId}-${projectorShowMain ? 'main' : 'book'}`}
          name={iconName}
          size={size}
          accent={accent}
          spec={spec}
        />
      </span>
    )
  }

  if (plan.single) {
    return (
      <MaterialMotionIcon
        key={`single-${runId}`}
        replayKey={`single-${runId}`}
        name={primaryName}
        size={size}
        accent={accent}
        spec={plan.single}
      />
    )
  }

  return <MaterialIcon name={primaryName} size={size} accent={accent} />
}

function AnimatedCharacterNavIcon({
  active,
  replayToken,
  className,
}: {
  active: boolean
  replayToken: number
  className?: string
}) {
  const reduced = shouldReduceMotion()
  const plan = navMotionPlan('character')
  const [runId, setRunId] = useState(0)

  useEffect(() => {
    if (replayToken <= 0) return
    setRunId(replayToken)
  }, [replayToken])

  if (replayToken <= 0) {
    return (
      <CharacterNavIcon
        className={`${className ?? ''} ${active ? '' : 'opacity-90'}`.trim()}
      />
    )
  }

  if (reduced || !plan.shake) {
    return (
      <CharacterNavIcon
        className={`${className ?? ''} ${active ? '' : 'opacity-90'}`.trim()}
      />
    )
  }

  return (
    <motion.span
      key={`char-${runId}`}
      className="inline-flex"
      initial={{ x: 0 }}
      animate={plan.shake}
      transition={{ duration: motionDuration(plan.durationSec) || 0, ease: 'easeInOut' }}
    >
      <CharacterNavIcon
        className={`${className ?? ''} ${active ? '' : 'opacity-90'}`.trim()}
      />
    </motion.span>
  )
}

export function AnimatedNavIcon({
  to,
  variant,
  active,
  size,
  replayToken,
  characterClassName,
}: AnimatedNavIconProps) {
  const kind = navAnimationKindForRoute(to)
  if (!kind) {
    return null
  }

  if (kind === 'character') {
    return (
      <AnimatedCharacterNavIcon
        active={active}
        replayToken={replayToken}
        className={characterClassName}
      />
    )
  }

  return (
    <AnimatedMaterialNavIcon
      kind={kind}
      to={to}
      variant={variant}
      active={active}
      size={size}
      replayToken={replayToken}
    />
  )
}

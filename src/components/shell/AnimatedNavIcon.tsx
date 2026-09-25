import { motion } from 'framer-motion'
import { memo, useMemo } from 'react'
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

const motionIconClass = 'inline-flex transform-gpu items-center justify-center will-change-transform'

function motionTransition(spec: NavMotionPhaseSpec) {
  const base = spec.transition as { duration?: number; delay?: number }
  return {
    ...spec.transition,
    duration: motionDuration(base.duration ?? 0.26),
    delay: motionDuration(base.delay ?? 0),
  }
}

function MaterialMotionIcon({
  name,
  size,
  accent,
  className,
  spec,
  replayToken,
  phase,
}: {
  name: string
  size: number
  accent: boolean
  className?: string
  spec: NavMotionPhaseSpec
  replayToken: number
  phase: string
}) {
  return (
    <motion.span
      key={`${phase}-${replayToken}`}
      className={`${motionIconClass} ${className ?? ''}`}
      initial={spec.initial}
      animate={spec.animate}
      transition={motionTransition(spec)}
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

  if (replayToken <= 0) {
    return <MaterialIcon name={primaryName} size={size} accent={active} className={active ? '' : 'opacity-90'} />
  }

  const accent = active
  const boxClass = 'relative inline-grid transform-gpu place-items-center overflow-hidden'
  const boxStyle = { width: size + 6, height: size + 6 }

  if (kind === 'envelope' && plan.letter && plan.primary) {
    return (
      <span className={boxClass} style={boxStyle}>
        <MaterialMotionIcon
          phase="letter"
          replayToken={replayToken}
          name={NAV_LETTER_ICON}
          size={size}
          accent={accent}
          className="absolute inset-0"
          spec={plan.letter}
        />
        <MaterialMotionIcon
          phase="primary"
          replayToken={replayToken}
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
    return (
      <span className={boxClass} style={boxStyle}>
        <MaterialMotionIcon
          phase="book"
          replayToken={replayToken}
          name={NAV_ICONS.projectorBook}
          size={size}
          accent={accent}
          className="absolute inset-0"
          spec={plan.book}
        />
        <MaterialMotionIcon
          phase="projector"
          replayToken={replayToken}
          name={NAV_ICONS.projector}
          size={size}
          accent={accent}
          className="absolute inset-0"
          spec={plan.primary}
        />
      </span>
    )
  }

  if (plan.single) {
    return (
      <MaterialMotionIcon
        phase="single"
        replayToken={replayToken}
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
  const mergedClass = `${className ?? ''} ${active ? '' : 'opacity-90'}`.trim()

  if (replayToken <= 0 || reduced || !plan.shake) {
    return <CharacterNavIcon className={mergedClass} />
  }

  return (
    <motion.span
      key={`char-${replayToken}`}
      className={`${motionIconClass} inline-flex`}
      initial={{ x: 0 }}
      animate={plan.shake}
      transition={{ duration: motionDuration(plan.durationSec) || 0, ease: 'easeOut' }}
    >
      <CharacterNavIcon className={mergedClass} />
    </motion.span>
  )
}

function AnimatedNavIconInner({
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

export const AnimatedNavIcon = memo(AnimatedNavIconInner)

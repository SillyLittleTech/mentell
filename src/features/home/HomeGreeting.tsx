import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  motionDuration,
  shouldReduceMotion,
} from '../../shared/motion/useMotionPrefs'
import { formatGreetingSegments } from './greetingAddress'
import { useHomeGreeting } from './useHomeGreeting'

type LetterToken = {
  key: string
  char: string
  isName: boolean
  letterIndex: number
}

type TokenRun = {
  key: string
  isName: boolean
  tokens: LetterToken[]
}

function wordsFromTokens(tokens: LetterToken[]): LetterToken[][] {
  const words: LetterToken[][] = []
  let current: LetterToken[] = []
  for (const token of tokens) {
    if (token.char === ' ') {
      if (current.length) words.push(current)
      current = []
    } else {
      current.push(token)
    }
  }
  if (current.length) words.push(current)
  return words
}

function tokensFromPhrase(template: string, name: string): LetterToken[] {
  const segments = formatGreetingSegments(template, name)
  const tokens: LetterToken[] = []
  let letterIndex = 0
  segments.forEach((segment, segmentIndex) => {
    Array.from(segment.value).forEach((char, charIndex) => {
      tokens.push({
        key: `${segment.kind}-${segmentIndex}-${charIndex}`,
        char,
        isName: segment.kind === 'name',
        letterIndex,
      })
      letterIndex += 1
    })
  })
  return tokens
}

function runsFromTokens(tokens: LetterToken[]): TokenRun[] {
  const runs: TokenRun[] = []
  for (const token of tokens) {
    const last = runs[runs.length - 1]
    if (last && last.isName === token.isName) {
      last.tokens.push(token)
    } else {
      runs.push({
        key: `run-${token.key}`,
        isName: token.isName,
        tokens: [token],
      })
    }
  }
  return runs
}

function DustPuff({ active, delay }: { active: boolean; delay: number }) {
  const grains = [
    { x: -11, y: 3, size: 5, drift: -9 },
    { x: -3, y: 5, size: 3.5, drift: -3 },
    { x: 4, y: 4, size: 4.5, drift: 6 },
    { x: 12, y: 2, size: 3.5, drift: 11 },
  ]

  return (
    <AnimatePresence>
      {active
        ? grains.map((grain, index) => (
            <motion.span
              key={`${delay}-${index}`}
              className="home-greeting-dust"
              style={{
                width: grain.size,
                height: grain.size * 0.5,
                left: `calc(50% + ${grain.x}px)`,
                bottom: grain.y,
              }}
              initial={{ opacity: 0, scale: 0.35, x: 0, y: 0 }}
              animate={{
                opacity: [0, 0.5, 0],
                scale: [0.35, 1.2, 0.65],
                x: grain.drift,
                y: [0, 3, 7],
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: motionDuration(0.46) || 0.01,
                delay: delay + (motionDuration(0.54) || 0),
                ease: 'easeOut',
              }}
            />
          ))
        : null}
    </AnimatePresence>
  )
}

function GreetingLetter({
  token,
  playing,
  reduced,
  hopDuration,
  stagger,
}: {
  token: LetterToken
  playing: boolean
  reduced: boolean
  hopDuration: number
  stagger: number
}) {
  const delay = token.letterIndex * stagger
  return (
    <span
      className={`home-greeting-letter${token.isName && playing ? ' is-glowing' : ''}`}
    >
      <motion.span
        className="home-greeting-glyph"
        initial={false}
        animate={
          playing && !reduced
            ? {
                y: [0, 6, -32, -34, 3, 8, 0],
                scaleX: [1, 1.38, 0.64, 0.76, 1.42, 1.18, 1],
                scaleY: [1, 0.52, 1.48, 1.24, 0.54, 0.82, 1],
                rotate: [0, -5, 4, -2.5, 2, -1.2, 0],
              }
            : { y: 0, scaleX: 1, scaleY: 1, rotate: 0 }
        }
        transition={
          playing && !reduced
            ? {
                duration: hopDuration,
                delay,
                times: [0, 0.11, 0.38, 0.48, 0.73, 0.86, 1],
                ease: [0.2, 0.86, 0.24, 1],
              }
            : { duration: motionDuration(0.18) || 0.01 }
        }
      >
        {token.char}
      </motion.span>
      <DustPuff active={playing && !reduced} delay={delay} />
    </span>
  )
}

function GoldSparkles({ active }: { active: boolean }) {
  const sparks = [
    { left: '6%', top: '-28%', delay: 0, size: 8 },
    { left: '32%', top: '-12%', delay: 0.07, size: 5 },
    { left: '58%', top: '-32%', delay: 0.13, size: 7 },
    { left: '86%', top: '-10%', delay: 0.04, size: 5 },
    { left: '18%', top: '78%', delay: 0.16, size: 4 },
    { left: '72%', top: '82%', delay: 0.1, size: 5 },
  ]

  return (
    <AnimatePresence>
      {active
        ? sparks.map((spark, index) => (
            <motion.span
              key={index}
              className="home-greeting-sparkle"
              style={{
                left: spark.left,
                top: spark.top,
                width: spark.size,
                height: spark.size,
              }}
              initial={{ opacity: 0, scale: 0.15, rotate: 12 }}
              animate={{
                opacity: [0, 1, 0.4, 1, 0],
                scale: [0.15, 1.2, 0.75, 1.05, 0.2],
                rotate: [12, 50, 90],
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: motionDuration(1.05) || 0.01,
                delay: motionDuration(spark.delay) || 0,
                ease: 'easeOut',
              }}
            />
          ))
        : null}
    </AnimatePresence>
  )
}

export function HomeGreeting({
  variant,
  fallback = null,
}: {
  variant: 'desktop' | 'mobile'
  fallback?: ReactNode
}) {
  const greeting = useHomeGreeting()
  const playGen = useRef(0)
  const [wave, setWave] = useState(0)
  const [playing, setPlaying] = useState(false)
  const reduced = shouldReduceMotion()
  const glowTimer = useRef<number | null>(null)

  const tokens = useMemo(
    () => (greeting ? tokensFromPhrase(greeting.template.text, greeting.name) : []),
    [greeting],
  )
  const runs = useMemo(() => runsFromTokens(tokens), [tokens])

  useEffect(() => {
    return () => {
      if (glowTimer.current != null) window.clearTimeout(glowTimer.current)
    }
  }, [])

  if (!greeting) return fallback ? <>{fallback}</> : null

  const hopDuration = motionDuration(0.82) || 0
  const stagger = motionDuration(0.05) || 0
  const lastLetterDelay = Math.max(0, tokens.length - 1) * stagger
  const glowMs = Math.round((reduced ? 0.95 : lastLetterDelay + hopDuration + 0.28) * 1000)

  function replay() {
    playGen.current += 1
    const gen = playGen.current
    setWave(gen)
    setPlaying(true)
    if (glowTimer.current != null) window.clearTimeout(glowTimer.current)
    glowTimer.current = window.setTimeout(() => {
      if (playGen.current === gen) setPlaying(false)
    }, Math.max(glowMs, 420))
  }

  return (
    <button
      type="button"
      className={`home-greeting home-greeting--${variant} focus-ring`}
      onClick={replay}
      aria-label={`${greeting.phrase}. Play greeting animation.`}
    >
      <span className="home-greeting-line" aria-hidden>
        {runs.map((run) => {
          const words = wordsFromTokens(run.tokens)
          return (
            <span
              key={`${wave}-${run.key}`}
              className={run.isName ? 'home-greeting-name-group' : undefined}
            >
              {run.tokens[0]?.char === ' ' ? ' ' : null}
              {words.map((word, wordIndex) => (
                <span key={`${word[0]?.key ?? wordIndex}`}>
                  {wordIndex > 0 ? ' ' : null}
                  <span className="home-greeting-word">
                    {word.map((token) => (
                      <GreetingLetter
                        key={token.key}
                        token={token}
                        playing={playing}
                        reduced={reduced}
                        hopDuration={hopDuration}
                        stagger={stagger}
                      />
                    ))}
                  </span>
                </span>
              ))}
              {run.tokens.length > 1 && run.tokens[run.tokens.length - 1]?.char === ' '
                ? ' '
                : null}
              {run.isName ? <GoldSparkles active={playing} /> : null}
            </span>
          )
        })}
      </span>
    </button>
  )
}

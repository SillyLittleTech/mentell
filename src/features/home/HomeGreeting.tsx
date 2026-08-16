import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { shouldReduceMotion } from '../../shared/motion/useMotionPrefs'
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

type Unsubscribe = () => void

const STAGGER_MS = 36
const GLOW_MS = 2500
const SPARKLE_MS = 900

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

const DUST_GRAINS = [
  { x: -8, size: 4.5, drift: -8 },
  { x: 9, size: 4, drift: 10 },
]

function GreetingLetter({
  token,
  subscribeRipple,
}: {
  token: LetterToken
  subscribeRipple: (listener: () => void) => Unsubscribe
}) {
  const [hopNonce, setHopNonce] = useState(0)
  const [glowing, setGlowing] = useState(false)
  const hopTimers = useRef<number[]>([])
  const glowTimer = useRef<number | null>(null)
  const reduced = shouldReduceMotion()

  useEffect(() => {
    const onRipple = () => {
      const delay = reduced ? 0 : token.letterIndex * STAGGER_MS
      const hopTimer = window.setTimeout(() => {
        setHopNonce((nonce) => nonce + 1)
        if (!token.isName) return
        setGlowing(true)
        if (glowTimer.current != null) window.clearTimeout(glowTimer.current)
        glowTimer.current = window.setTimeout(() => setGlowing(false), GLOW_MS)
      }, delay)
      hopTimers.current.push(hopTimer)
    }

    const unsubscribe = subscribeRipple(onRipple)
    return () => {
      unsubscribe()
      hopTimers.current.forEach((timer) => window.clearTimeout(timer))
      hopTimers.current = []
      if (glowTimer.current != null) window.clearTimeout(glowTimer.current)
    }
  }, [subscribeRipple, token.letterIndex, token.isName, reduced])

  const isHopping = hopNonce > 0 && !reduced

  return (
    <span className={`home-greeting-letter${glowing ? ' is-glowing' : ''}`}>
      <span key={hopNonce} className={`home-greeting-glyph${isHopping ? ' is-hopping' : ''}`}>
        {token.char}
      </span>
      {isHopping
        ? DUST_GRAINS.map((grain, index) => (
            <span
              key={`${hopNonce}-${index}`}
              className="home-greeting-dust"
              style={
                {
                  '--dust-x': `${grain.x}px`,
                  '--dust-drift': `${grain.drift}px`,
                  width: grain.size,
                  height: grain.size * 0.5,
                } as CSSProperties
              }
            />
          ))
        : null}
    </span>
  )
}

const SPARKLES = [
  { left: '12%', top: '-28%', delay: '0ms', size: 7 },
  { left: '48%', top: '-16%', delay: '80ms', size: 5 },
  { left: '82%', top: '-30%', delay: '40ms', size: 6 },
  { left: '70%', top: '78%', delay: '110ms', size: 4 },
]

export function HomeGreeting({
  variant,
  fallback = null,
  autoPlay = false,
  context,
}: {
  variant: 'desktop' | 'mobile'
  fallback?: ReactNode
  autoPlay?: boolean
  context?: string
}) {
  const greeting = useHomeGreeting(context)
  const rippleListeners = useRef(new Set<() => void>())
  const [sparkNonce, setSparkNonce] = useState(0)
  const sparkTimer = useRef<number | null>(null)
  const [playing, setPlaying] = useState(false)

  const subscribeRipple = useCallback((listener: () => void) => {
    rippleListeners.current.add(listener)
    return () => {
      rippleListeners.current.delete(listener)
    }
  }, [])

  const replay = useCallback(() => {
    rippleListeners.current.forEach((listener) => listener())
    setSparkNonce((nonce) => nonce + 1)
    setPlaying(true)
    if (sparkTimer.current != null) window.clearTimeout(sparkTimer.current)
    sparkTimer.current = window.setTimeout(() => setPlaying(false), SPARKLE_MS)
  }, [])

  useEffect(() => {
    if (!autoPlay || !greeting) return
    // Defer so letter ripple listeners subscribe before the first wave, and so we
    // do not setState synchronously inside the effect body.
    const frame = window.requestAnimationFrame(() => replay())
    return () => window.cancelAnimationFrame(frame)
    // greeting is a new object each render; phrase is the stable signal for name/template changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, greeting?.phrase, replay])

  useEffect(() => {
    return () => {
      if (sparkTimer.current != null) window.clearTimeout(sparkTimer.current)
    }
  }, [])

  const tokens = useMemo(
    () => (greeting ? tokensFromPhrase(greeting.template.text, greeting.name) : []),
    [greeting],
  )
  const runs = useMemo(() => runsFromTokens(tokens), [tokens])

  if (!greeting) return fallback ? <>{fallback}</> : null

  return (
    <button
      type="button"
      className={`home-greeting home-greeting--${variant} focus-ring${
        playing ? ' is-playing' : ''
      }`}
      onClick={replay}
      aria-label={`${greeting.phrase}. Play greeting animation.`}
    >
      <span className="home-greeting-line" aria-hidden>
        {runs.map((run) => {
          const words = wordsFromTokens(run.tokens)
          return (
            <span
              key={run.key}
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
                        subscribeRipple={subscribeRipple}
                      />
                    ))}
                  </span>
                </span>
              ))}
              {run.tokens.length > 1 && run.tokens[run.tokens.length - 1]?.char === ' '
                ? ' '
                : null}
              {run.isName
                ? SPARKLES.map((spark, index) => (
                    <span
                      key={`${sparkNonce}-${index}`}
                      className={`home-greeting-sparkle${sparkNonce > 0 ? ' is-sparking' : ''}`}
                      style={
                        {
                          left: spark.left,
                          top: spark.top,
                          width: spark.size,
                          height: spark.size,
                          '--spark-delay': spark.delay,
                        } as CSSProperties
                      }
                    />
                  ))
                : null}
            </span>
          )
        })}
      </span>
    </button>
  )
}

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
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

const STAGGER_MS = 36

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
  waves,
}: {
  token: LetterToken
  waves: number[]
}) {
  const [activeWave, setActiveWave] = useState<number | null>(null)
  const waveGen = useRef(0)
  const reduced = shouldReduceMotion()

  useEffect(() => {
    if (waves.length === 0) return
    const latest = waves[waves.length - 1]!
    waveGen.current += 1
    const gen = waveGen.current

    let hopTimer: number
    let glowTimer: number


    if (reduced) {
      setActiveWave(null)
      window.requestAnimationFrame(() => {
        if (waveGen.current !== gen) return
        setActiveWave(latest)
        glowTimer = window.setTimeout(() => {
          if (waveGen.current === gen) setActiveWave(null)
        }, 2500)
      })
    } else {
      hopTimer = window.setTimeout(() => {
        if (waveGen.current !== gen) return

        // Clear active state momentarily to force animation restart, but only once the stagger time has been reached
        setActiveWave(null)

        window.requestAnimationFrame(() => {
          if (waveGen.current !== gen) return
          setActiveWave(latest)
        })
      }, token.letterIndex * STAGGER_MS)

      glowTimer = window.setTimeout(() => {
        if (waveGen.current === gen) setActiveWave(null)
      }, token.letterIndex * STAGGER_MS + 2500)
    }

    return () => {
      window.clearTimeout(hopTimer)
      window.clearTimeout(glowTimer)
    }
  }, [waves, token.letterIndex, reduced])

  const isHopping = activeWave !== null && !reduced
  const isGlowing = activeWave !== null && token.isName

  return (
    <span
      className={`home-greeting-letter${isGlowing ? ' is-glowing' : ''}${isHopping ? ' is-hopping-active' : ''}`}
    >
      <span className="home-greeting-glyph">{token.char}</span>
      {DUST_GRAINS.map((grain, index) => (
        <span
          key={index}
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
      ))}
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
  const [waves, setWaves] = useState<number[]>([])
  const playGen = useRef(0)
  const [playing, setPlaying] = useState(false)
  const glowTimer = useRef<number | null>(null)

  useEffect(() => {
    if (autoPlay && greeting) replay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, greeting?.phrase])

  useEffect(() => {
    return () => {
      if (glowTimer.current != null) window.clearTimeout(glowTimer.current)
    }
  }, [])

  const tokens = useMemo(
    () => (greeting ? tokensFromPhrase(greeting.template.text, greeting.name) : []),
    [greeting],
  )
  const runs = useMemo(() => runsFromTokens(tokens), [tokens])

  if (!greeting) return fallback ? <>{fallback}</> : null

  function replay() {
    setWaves(prev => [...prev, Date.now()])

    // Manage playing state for sparkles
    playGen.current += 1
    const gen = playGen.current
    setPlaying(false)
    window.requestAnimationFrame(() => {
      if (playGen.current !== gen) return
      setPlaying(true)
    })
    if (glowTimer.current != null) window.clearTimeout(glowTimer.current)
    glowTimer.current = window.setTimeout(() => {
      if (playGen.current === gen) setPlaying(false)
    }, 2500)
  }

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
                        waves={waves}
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
                      key={index}
                      className="home-greeting-sparkle"
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

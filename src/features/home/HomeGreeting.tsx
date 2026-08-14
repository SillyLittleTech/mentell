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

const HOP_MS = 850
const STAGGER_MS = 48
const SPARKLE_MS = 1050

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
  { x: -11, size: 5, drift: -9 },
  { x: -3, size: 3.5, drift: -3 },
  { x: 5, size: 4.5, drift: 7 },
  { x: 12, size: 3.5, drift: 12 },
]

function GreetingLetter({
  token,
  glowing,
}: {
  token: LetterToken
  glowing: boolean
}) {
  return (
    <span
      className={`home-greeting-letter${glowing && token.isName ? ' is-glowing' : ''}`}
      style={{ '--letter-index': token.letterIndex } as CSSProperties}
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
  { left: '8%', top: '-30%', delay: '0ms', size: 8 },
  { left: '34%', top: '-14%', delay: '70ms', size: 5 },
  { left: '58%', top: '-34%', delay: '130ms', size: 7 },
  { left: '86%', top: '-12%', delay: '40ms', size: 5 },
  { left: '18%', top: '78%', delay: '160ms', size: 4 },
  { left: '74%', top: '82%', delay: '100ms', size: 5 },
]

export function HomeGreeting({
  variant,
  fallback = null,
}: {
  variant: 'desktop' | 'mobile'
  fallback?: ReactNode
}) {
  const greeting = useHomeGreeting()
  const playGen = useRef(0)
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

  const lastLetterDelay = Math.max(0, tokens.length - 1) * STAGGER_MS
  const glowMs = reduced
    ? 950
    : lastLetterDelay + HOP_MS + 280

  function replay() {
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
    }, Math.max(glowMs, SPARKLE_MS))
  }

  return (
    <button
      type="button"
      className={`home-greeting home-greeting--${variant} focus-ring${
        playing ? ' is-playing' : ''
      }${playing && !reduced ? ' is-hopping' : ''}`}
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
                        glowing={playing}
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

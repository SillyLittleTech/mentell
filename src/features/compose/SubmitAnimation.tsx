import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { motionDuration, shouldReduceMotion } from '../../shared/motion/useMotionPrefs'
import { RopeWrap } from './RopeWrap'
import { useEquippedStampAsset } from '../shop/shopStampAsset'

type Phase = 'stamp' | 'rope' | 'mailbox'

export function SubmitAnimation({
  open,
  onFinished,
}: {
  open: boolean
  onFinished: () => void
}) {
  const [phase, setPhase] = useState<Phase>('stamp')
  const [stampLanded, setStampLanded] = useState(false)
  const reduced = shouldReduceMotion()
  const stamp = useEquippedStampAsset()

  useEffect(() => {
    if (!open) return

    const d = (ms: number) => motionDuration(ms) || (reduced ? 50 : ms)

    const tLand = setTimeout(() => setStampLanded(true), d(reduced ? 80 : 520))
    const t1 = setTimeout(() => setPhase('rope'), d(reduced ? 200 : 1000))
    const t2 = setTimeout(() => setPhase('mailbox'), d(reduced ? 500 : 2800))
    const t3 = setTimeout(() => onFinished(), d(reduced ? 900 : 3700))

    return () => {
      clearTimeout(tLand)
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [onFinished, open, reduced])

  const showRopePasses = phase === 'rope' || phase === 'mailbox'
  const showKnot = phase === 'rope' || phase === 'mailbox'

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-black/35 p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <p className="ink-muted mb-4 text-center font-mono text-sm tracking-wide text-white/90">
            Sealing your envelope…
          </p>

          <motion.div
            className="relative w-full max-w-lg"
            initial={{ scale: 0.96, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.98, y: 8 }}
            transition={{ duration: motionDuration(0.35) || 0.01, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <motion.div
              className="submit-letter paper relative"
              animate={
                phase === 'mailbox'
                  ? {
                      rotateX: 55,
                      rotateZ: -10,
                      y: 60,
                      scale: 0.9,
                      opacity: 0.95,
                    }
                  : { rotateX: 0, rotateZ: 0, y: 0, scale: 1, opacity: 1 }
              }
              transition={{ duration: motionDuration(0.7) || 0.01, ease: [0.22, 0.9, 0.22, 1] }}
              style={{ transformPerspective: 900 }}
            >
              <div className="pointer-events-none absolute inset-x-10 top-12 h-[1px] bg-black/10" />
              <div className="pointer-events-none absolute inset-x-10 top-20 h-[1px] bg-black/8" />
              <div className="pointer-events-none absolute inset-x-10 top-28 h-[1px] bg-black/6" />

              <div className="flex min-h-[280px] items-center justify-center p-8">
                <div className="relative h-52 w-full max-w-sm">
                  <div
                    className="paper absolute inset-0 rounded-3xl shadow-inner"
                    style={{ background: 'var(--paper-bg)' }}
                  />

                  <RopeWrap active={showRopePasses} showKnot={showKnot} />

                  {stampLanded ? (
                    <img
                      alt=""
                      src={stamp.src}
                      draggable={false}
                      className="pointer-events-none absolute left-1/2 top-1/2 h-[45%] w-[45%] min-h-[100px] min-w-[100px] -translate-x-1/2 -translate-y-1/2 select-none object-contain"
                      style={{
                        opacity: stamp.isCustom ? 0.56 : 0.34,
                        filter: `drop-shadow(0 9px 16px color-mix(in oklab, ${stamp.outline} 40%, transparent))`,
                      }}
                      aria-hidden
                    />
                  ) : null}

                  <AnimatePresence>
                    {phase === 'stamp' ? (
                      <motion.div
                        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                        initial={
                          reduced
                            ? { opacity: 1, y: 0, rotate: -14, scaleY: 1 }
                            : { opacity: 0, y: -100, rotate: -24, scaleY: 1 }
                        }
                        animate={{ opacity: 1, y: 0, rotate: -14, scaleY: 1 }}
                        exit={{ opacity: 0 }}
                        transition={
                          reduced
                            ? { duration: 0.01 }
                            : {
                                y: { type: 'spring', stiffness: 420, damping: 14, mass: 0.8 },
                                rotate: { duration: motionDuration(0.35) || 0.01 },
                                opacity: { duration: motionDuration(0.2) || 0.01 },
                              }
                        }
                        onAnimationComplete={() => {
                          if (!reduced) setStampLanded(true)
                        }}
                      >
                        <motion.img
                          alt=""
                          src={stamp.src}
                          draggable={false}
                          className="h-[200px] w-[200px] max-w-[min(45vw,220px)] select-none object-contain"
                          style={{
                            filter: `drop-shadow(0 18px 30px color-mix(in oklab, ${stamp.outline} 48%, transparent))`,
                          }}
                          initial={reduced ? {} : { scaleY: 1 }}
                          animate={
                            reduced
                              ? {}
                              : {
                                  scaleY: [1, 0.88, 1],
                                }
                          }
                          transition={{
                            scaleY: {
                              delay: motionDuration(0.35) || 0,
                              duration: motionDuration(0.2) || 0.01,
                            },
                          }}
                        />
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

                  <AnimatePresence>
                    {phase === 'mailbox' ? (
                      <motion.div
                        className="absolute -bottom-10 left-1/2 h-2 w-52 -translate-x-1/2 rounded-pill bg-black/35"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                      />
                    ) : null}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </motion.div>

          <p className="ink-muted mt-4 text-center text-xs text-white/75">Stamp, wrap, send.</p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

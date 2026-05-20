import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { getSlowMo } from '../../shared/debug/debugFlags'

export function SubmitAnimation({
  open,
  onFinished,
}: {
  open: boolean
  onFinished: () => void
}) {
  const [phase, setPhase] = useState<'stamp' | 'rope' | 'mailbox'>('stamp')

  useEffect(() => {
    if (!open) return
    const mult = getSlowMo()
    const t1 = setTimeout(() => setPhase('rope'), 850 * mult)
    const t2 = setTimeout(() => setPhase('mailbox'), 1650 * mult)
    const t3 = setTimeout(() => onFinished(), 2450 * mult)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [onFinished, open])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative w-full max-w-xl"
            initial={{ scale: 0.96, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.98, y: 8 }}
            transition={{ duration: 0.35 * getSlowMo(), ease: [0.2, 0.8, 0.2, 1] }}
          >
            <motion.div
              className="paper relative rounded-[28px] p-8"
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
              transition={{ duration: 0.7 * getSlowMo(), ease: [0.22, 0.9, 0.22, 1] }}
              style={{ transformPerspective: 900 }}
            >
              <div className="pointer-events-none absolute inset-x-10 top-10 h-[1px] bg-black/10" />
              <div className="pointer-events-none absolute inset-x-10 top-16 h-[1px] bg-black/8" />

              <div className="font-paper text-2xl">Sealing your envelope…</div>
              <div className="ink-muted mt-1 text-sm">Stamp, wrap, send.</div>

              <div className="mt-8 flex items-center justify-center">
                <div className="relative h-40 w-full max-w-sm">
                  <motion.div
                    className="paper absolute inset-0 rounded-3xl"
                    style={{ background: 'var(--paper-bg)' }}
                  />

                  {/* rope */}
                  <AnimatePresence>
                    {phase === 'rope' || phase === 'mailbox' ? (
                      <motion.div
                        className="absolute inset-0"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <img
                          alt=""
                          src="/asset/rope.png"
                          draggable={false}
                          className="absolute -inset-10 select-none opacity-90"
                          style={{
                            filter: 'drop-shadow(0 16px 26px rgba(0,0,0,0.18))',
                          }}
                        />
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

                  {/* stamp */}
                  <AnimatePresence>
                    {phase === 'stamp' ? (
                      <motion.div
                        className="absolute -right-4 -top-6 select-none"
                        initial={{ opacity: 0, y: -20, rotate: -20 }}
                        animate={{ opacity: 1, y: 0, rotate: -18 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 * getSlowMo() }}
                      >
                        <motion.div
                          animate={{ y: [0, 26, 0] }}
                          transition={{
                            duration: 0.55 * getSlowMo(),
                            ease: [0.2, 0.8, 0.2, 1],
                          }}
                        >
                          <img
                            alt=""
                            src="/asset/stamp.png"
                            draggable={false}
                            className="h-[260px] w-[260px] select-none"
                            style={{
                              filter: 'drop-shadow(0 18px 30px rgba(0,0,0,0.22))',
                            }}
                          />
                        </motion.div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

                  {/* mailbox slot hint */}
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
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}


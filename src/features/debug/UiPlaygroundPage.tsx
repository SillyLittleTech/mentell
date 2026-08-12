import React, { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { shouldReduceMotion, motionDuration } from '../../shared/motion/useMotionPrefs'
import { MaterialIcon } from '../../components/MaterialIcon'
import { SentimentPills, type SentimentValue } from '../../components/SentimentPills'
import { ScoreTicker } from '../score/ScoreTicker'
import { ScoreBurst } from '../score/ScoreBurst'
import { StreakDisplay } from '../score/StreakDisplay'
import { SubmitAnimation } from '../compose/SubmitAnimation'
import { DeskCharacterLayout } from '../character/DeskCharacterLayout'
import { pageTransitionProps } from '../../shared/motion/pageTransition'

type TabId = 'buttons' | 'inputs' | 'animations' | 'score'

function DebugThemeSpinButton() {
  const reduced = shouldReduceMotion()
  const [spinning, setSpinning] = useState(false)

  return (
    <button
      type="button"
      className="focus-ring paper flex h-12 w-12 items-center justify-center rounded-full"
      aria-label="Play theme toggle animation"
      onClick={() => {
        if (reduced) return
        setSpinning(true)
        window.setTimeout(() => setSpinning(false), 520)
      }}
    >
      <motion.div
        animate={{ rotate: spinning ? 180 : 0 }}
        transition={{ duration: reduced ? 0 : 0.45, ease: 'easeInOut' }}
      >
        <MaterialIcon name="theme_light_dark" size={22} accent={false} className="opacity-80" />
      </motion.div>
    </button>
  )
}

function ModalDemo({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reduced = shouldReduceMotion()

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/25"
            initial={reduced ? undefined : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduced ? undefined : { opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2"
            initial={reduced ? undefined : { opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? undefined : { opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: reduced ? 0 : 0.22, ease: 'easeOut' }}
          >
            <div className="paper rounded-3xl p-5 shadow-lg border border-[var(--paper-border)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-paper text-lg">Modal playground</div>
                  <div className="ink-muted mt-1 text-sm">
                    Click backdrop to dismiss. Local-only demo.
                  </div>
                </div>
                <button
                  type="button"
                  className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-sm font-semibold"
                  onClick={onClose}
                >
                  Close
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  className="btn-primary focus-ring rounded-2xl px-4 py-3 text-sm font-medium"
                  onClick={onClose}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  className="focus-ring rounded-2xl border border-[var(--paper-border)] px-4 py-3 text-sm font-medium"
                  onClick={onClose}
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}

function AnimationsTab({
  reduced,
  onOpenModal,
  scoreTotal,
  setScoreTotal,
  streak,
  setStreak,
}: {
  reduced: boolean
  onOpenModal: () => void
  scoreTotal: number
  setScoreTotal: React.Dispatch<React.SetStateAction<number>>
  streak: number
  setStreak: React.Dispatch<React.SetStateAction<number>>
}) {
  const [submitOpen, setSubmitOpen] = useState(false)
  const [scoreBurst, setScoreBurst] = useState<{ delta: number; key: number } | null>(null)
  const [pageKey, setPageKey] = useState(0)
  const [buttonBounce, setButtonBounce] = useState(false)
  const [breakKey, setBreakKey] = useState(0)

  return (
    <section className="paper rounded-3xl p-6">
      <div className="font-paper text-xl">Animation triggers</div>
      <div className="ink-muted mt-1 text-sm">
        Play real app animations locally. Reduced-motion safe.
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Submit / envelope seal animation */}
        <div className="rounded-3xl border border-[var(--paper-border)] p-5">
          <div className="font-medium">Submit (envelope seal)</div>
          <div className="ink-muted mt-1 text-sm">Full stamp → rope → mailbox sequence.</div>
          <div className="mt-3">
            <button
              type="button"
              className="btn-primary focus-ring rounded-2xl px-4 py-3 text-sm font-medium"
              onClick={() => setSubmitOpen(true)}
            >
              Play send
            </button>
          </div>
        </div>

        {/* Score gain burst */}
        <div className="rounded-3xl border border-[var(--paper-border)] p-5">
          <div className="font-medium">Score gain (+100)</div>
          <div className="ink-muted mt-1 text-sm">Counting overlay with confetti burst.</div>
          <div className="mt-3">
            <button
              type="button"
              className="btn-primary focus-ring rounded-2xl px-4 py-3 text-sm font-medium"
              onClick={() => {
                setScoreTotal((s) => s + 100)
                setScoreBurst({ delta: 100, key: Date.now() })
              }}
            >
              +100 burst
            </button>
          </div>
        </div>

        {/* Score loss burst */}
        <div className="rounded-3xl border border-[var(--paper-border)] p-5">
          <div className="font-medium">Score spend (−50)</div>
          <div className="ink-muted mt-1 text-sm">Negative counting overlay (Shoppe purchase).</div>
          <div className="mt-3">
            <button
              type="button"
              className="focus-ring rounded-2xl border border-[var(--paper-border)] px-4 py-3 text-sm font-medium"
              onClick={() => {
                setScoreTotal((s) => Math.max(0, s - 50))
                setScoreBurst({ delta: -50, key: Date.now() })
              }}
            >
              −50 burst
            </button>
          </div>
        </div>

        {/* Streak break */}
        <div className="rounded-3xl border border-[var(--paper-border)] p-5">
          <div className="font-medium">Streak break</div>
          <div className="ink-muted mt-1 text-sm">Crack + zero animation on the streak chip.</div>
          <div className="mt-3">
            <StreakDisplay
              streak={0}
              reducedMotion={reduced}
              pulse={false}
              variant="chip"
              outcomeAnimation={breakKey ? { kind: 'break', key: breakKey, from: streak } : undefined}
            />
            <button
              type="button"
              className="focus-ring mt-2 rounded-2xl border border-[var(--paper-border)] px-4 py-3 text-sm font-medium"
              onClick={() => {
                setBreakKey(Date.now())
                setStreak(0)
              }}
            >
              Break streak
            </button>
          </div>
        </div>

        {/* Page transition */}
        <div className="rounded-3xl border border-[var(--paper-border)] p-5">
          <div className="font-medium">Page transition</div>
          <div className="ink-muted mt-1 text-sm">Slant enter/leave route transition.</div>
          <div className="mt-3 relative min-h-[80px] overflow-hidden rounded-2xl border border-[var(--paper-border)]">
            <AnimatePresence mode="wait">
              <motion.div
                key={pageKey}
                className="flex items-center justify-center p-4"
                {...pageTransitionProps()}
              >
                <div className="font-mono text-sm opacity-70">Page {pageKey}</div>
              </motion.div>
            </AnimatePresence>
          </div>
          <button
            type="button"
            className="focus-ring mt-2 rounded-2xl border border-[var(--paper-border)] px-4 py-3 text-sm font-medium"
            onClick={() => setPageKey((k) => k + 1)}
          >
            Navigate →
          </button>
        </div>

        {/* Button press bounce */}
        <div className="rounded-3xl border border-[var(--paper-border)] p-5">
          <div className="font-medium">Button press bounce</div>
          <div className="ink-muted mt-1 text-sm">CSS :active scale via .desk utility.</div>
          <div className="mt-3">
            <motion.button
              type="button"
              className="btn-primary focus-ring rounded-2xl px-4 py-3 text-sm font-medium"
              animate={buttonBounce ? { scale: [1, 0.94, 1.02, 1] } : { scale: 1 }}
              transition={{ duration: motionDuration(0.3) || 0.01 }}
              onClick={() => {
                setButtonBounce(true)
                window.setTimeout(() => setButtonBounce(false), 350)
              }}
            >
              Tap me
            </motion.button>
          </div>
        </div>

        {/* Modal animation */}
        <div className="rounded-3xl border border-[var(--paper-border)] p-5">
          <div className="font-medium">Modal</div>
          <div className="ink-muted mt-1 text-sm">Framer-motion enter/exit overlay.</div>
          <div className="mt-3">
            <button
              type="button"
              className="focus-ring rounded-2xl border border-[var(--paper-border)] px-4 py-3 text-sm font-medium"
              onClick={onOpenModal}
            >
              Open modal
            </button>
          </div>
        </div>

        {/* Spotlight */}
        <div className="rounded-3xl border border-[var(--paper-border)] p-5">
          <div className="font-medium">Desk spotlight</div>
          <div className="ink-muted mt-1 text-sm">
            Move pointer around the page to see dot masking.
          </div>
          <div className="mt-3 flex items-center gap-2">
            <MaterialIcon name="location_on" size={18} accent={false} className="opacity-70" />
            <div className="ink-muted text-sm">Global (test in both themes).</div>
          </div>
        </div>
      </div>

      {/* Submit animation overlay */}
      <SubmitAnimation
        key={submitOpen ? 'submit-play' : 'submit-idle'}
        open={submitOpen}
        onFinished={() => setSubmitOpen(false)}
      />

      {/* Score burst overlay */}
      <AnimatePresence>
        {scoreBurst ? (
          <ScoreBurst
            key={scoreBurst.key}
            delta={scoreBurst.delta}
            totalAfter={scoreTotal}
            hint={null}
            onDone={() => setScoreBurst(null)}
          />
        ) : null}
      </AnimatePresence>
    </section>
  )
}

export function UiPlaygroundPage() {
  // Local-only UI; we intentionally avoid mutating global theme/auth/sync state.
  const reduced = shouldReduceMotion()
  const [tab, setTab] = useState<TabId>('buttons')
  const [sentiment, setSentiment] = useState<SentimentValue>('+')
  const [toggleOn, setToggleOn] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)

  const [scoreTotal, setScoreTotal] = useState(2000)
  const [streak, setStreak] = useState(2)

  const tabButtons = useMemo(
    () =>
      [
        { id: 'buttons', label: 'Buttons', icon: 'touch_app' },
        { id: 'inputs', label: 'Toggles', icon: 'tune' },
        { id: 'animations', label: 'Animations', icon: 'auto_awesome' },
        { id: 'score', label: 'Score', icon: 'trophy' },
      ] as const,
    [],
  )

  return (
    <DeskCharacterLayout>
      <div className="space-y-4">
        <section className="paper rounded-3xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-paper text-2xl">UI Playground</div>
              <div className="ink-muted mt-1 text-sm">
                Debug-only page for visual + animation testing. No app functionality.
              </div>
            </div>
            <DebugThemeSpinButton />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {tabButtons.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`focus-ring rounded-2xl border px-4 py-2 text-sm font-medium ${
                  tab === t.id
                    ? 'border-[var(--paper-border)] bg-[var(--pill-surface)]'
                    : 'border-[var(--paper-border)] bg-transparent'
                }`}
                onClick={() => setTab(t.id)}
              >
                <span className="inline-flex items-center gap-2">
                  <MaterialIcon name={t.icon} size={18} accent={false} className="opacity-80" />
                  {t.label}
                </span>
              </button>
            ))}
          </div>
        </section>

        {tab === 'buttons' ? (
          <section className="paper rounded-3xl p-6">
            <div className="font-paper text-xl">Button types</div>
            <div className="ink-muted mt-1 text-sm">Test hover/press/tap styling.</div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                className="btn-primary focus-ring rounded-2xl px-4 py-3 text-sm font-medium"
              >
                Primary
              </button>
              <button
                type="button"
                className="focus-ring rounded-2xl border border-[var(--paper-border)] px-4 py-3 text-sm font-medium"
              >
                Outline
              </button>
              <button
                type="button"
                className="focus-ring w-full rounded-2xl border-2 border-dashed border-[var(--paper-border)] px-4 py-3 text-sm font-medium"
              >
                Dashed
              </button>
              <button
                type="button"
                disabled
                className="focus-ring rounded-2xl border border-[var(--paper-border)] px-4 py-3 text-sm font-medium disabled:opacity-50"
              >
                Disabled
              </button>
              <button
                type="button"
                className="focus-ring paper flex h-12 items-center justify-center gap-2 rounded-3xl px-4 py-3 text-sm font-medium"
                onClick={() => setModalOpen(true)}
              >
                <MaterialIcon name="chat_bubble" size={18} accent={false} className="opacity-80" />
                Open modal
              </button>
              <button
                type="button"
                className="focus-ring paper flex h-12 w-12 items-center justify-center rounded-full"
                onClick={() => setModalOpen(true)}
                aria-label="Icon button demo"
              >
                <MaterialIcon name="auto_stories" size={22} accent={false} className="opacity-80" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[var(--paper-border)] p-4">
                <div className="font-mono text-xs uppercase opacity-70">Sentiment pills</div>
                <div className="mt-2">
                  <SentimentPills value={sentiment} onChange={setSentiment} />
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--paper-border)] p-4">
                <div className="font-mono text-xs uppercase opacity-70">Streak chip</div>
                <div className="mt-2">
                  <StreakDisplay streak={streak} reducedMotion={reduced} pulse={false} variant="chip" />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-sm"
                    onClick={() => setStreak((s) => Math.max(0, s - 1))}
                  >
                    -
                  </button>
                  <button
                    type="button"
                    className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-sm"
                    onClick={() => setStreak((s) => Math.min(9, s + 1))}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {tab === 'inputs' ? (
          <section className="paper rounded-3xl p-6">
            <div className="font-paper text-xl">Switch / input types</div>
            <div className="ink-muted mt-1 text-sm">No behavior beyond local state.</div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="focus-ring paper flex items-center justify-between gap-4 rounded-3xl px-5 py-4">
                <span>
                  <div className="font-medium">Toggle</div>
                  <div className="ink-muted mt-1 text-sm">Checkbox visual</div>
                </span>
                <input
                  type="checkbox"
                  checked={toggleOn}
                  onChange={(e) => setToggleOn(e.target.checked)}
                />
              </label>

              <div className="rounded-3xl border border-[var(--paper-border)] p-5">
                <div className="font-medium">Button + toggle</div>
                <div className="ink-muted mt-1 text-sm">Press to flip the checkbox.</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="focus-ring rounded-2xl border border-[var(--paper-border)] px-4 py-3 text-sm font-medium"
                    onClick={() => setToggleOn(false)}
                  >
                    Off
                  </button>
                  <button
                    type="button"
                    className="btn-primary focus-ring rounded-2xl px-4 py-3 text-sm font-medium"
                    onClick={() => setToggleOn(true)}
                  >
                    On
                  </button>
                </div>
                <div className="mt-3 ink-muted text-sm">Current: {toggleOn ? 'on' : 'off'}</div>
              </div>
            </div>
          </section>
        ) : null}

        {tab === 'animations' ? (
          <AnimationsTab
            reduced={reduced}
            onOpenModal={() => setModalOpen(true)}
            scoreTotal={scoreTotal}
            setScoreTotal={setScoreTotal}
            streak={streak}
            setStreak={setStreak}
          />
        ) : null}

        {tab === 'score' ? (
          <section className="paper rounded-3xl p-6">
            <div className="font-paper text-xl">Score + slot-machine</div>
            <div className="ink-muted mt-1 text-sm">Increase/decrease to watch direction-aware slide.</div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="focus-ring rounded-2xl border border-[var(--paper-border)] px-4 py-3 text-sm font-medium"
                onClick={() => setScoreTotal((v) => v - 37)}
                disabled={reduced}
                title={reduced ? 'Reduced motion enabled' : undefined}
              >
                -37
              </button>
              <button
                type="button"
                className="btn-primary focus-ring rounded-2xl px-4 py-3 text-sm font-medium"
                onClick={() => setScoreTotal((v) => v + 20)}
                disabled={reduced}
                title={reduced ? 'Reduced motion enabled' : undefined}
              >
                +20
              </button>
              <button
                type="button"
                className="focus-ring rounded-2xl border border-[var(--paper-border)] px-4 py-3 text-sm font-medium"
                onClick={() => setScoreTotal(2000)}
              >
                Reset
              </button>
            </div>

            <div className="mt-4">
              <ScoreTicker total={scoreTotal} streak={streak} streakFreezes={0} hint={null} />
            </div>
          </section>
        ) : null}
      </div>

      <ModalDemo open={modalOpen} onClose={() => setModalOpen(false)} />
    </DeskCharacterLayout>
  )
}


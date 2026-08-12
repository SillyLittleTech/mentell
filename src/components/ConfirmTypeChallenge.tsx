import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { motionDuration, shouldReduceMotion } from '../shared/motion/useMotionPrefs'

type Props = {
  open: boolean;
  title: string;
  description: string;
  challengeWord: string;
  confirmLabel: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmTypeChallenge({
  open,
  title,
  description,
  challengeWord,
  confirmLabel,
  busy = false,
  onCancel,
  onConfirm,
}: Props) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setTyped("");
  }, [open, challengeWord]);

  const reduced = shouldReduceMotion()
  const match = typed === challengeWord

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="confirm-type-challenge"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-challenge-title"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduced ? undefined : { opacity: 0 }}
        >
          <motion.div
            className="paper max-w-md p-6 shadow-lg"
            initial={reduced ? false : { scale: 0.97, y: 14 }}
            animate={{ scale: 1, y: 0 }}
            exit={reduced ? undefined : { scale: 0.99, y: 8 }}
            transition={{ duration: motionDuration(0.25) || 0 }}
          >
            <div id="confirm-challenge-title" className="font-paper text-xl">
              {title}
            </div>
            <p className="ink-muted mt-2 text-sm">{description}</p>
            <p className="mt-4 text-sm">
              Type <span className="font-mono font-semibold">{challengeWord}</span> to confirm.
            </p>
            <input
              type="text"
              autoComplete="off"
              className="focus-ring mt-2 w-full rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3 font-mono"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={challengeWord}
            />
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="focus-ring rounded-2xl border border-[var(--paper-border)] px-4 py-2 text-sm"
                disabled={busy}
                onClick={onCancel}
              >
                Cancel
              </button>
              <button
                type="button"
                className="focus-ring rounded-2xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: 'var(--danger)' }}
                disabled={!match || busy}
                onClick={onConfirm}
              >
                {busy ? 'Working…' : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

import { motion } from 'framer-motion'
import { publicUrl } from '../../shared/publicUrl'
import { motionDuration, shouldReduceMotion } from '../../shared/motion/useMotionPrefs'

const ROPE_URL = publicUrl('/asset/rope.png')
const SPRING = { type: 'spring' as const, stiffness: 140, damping: 16, mass: 0.9 }

function RopeBandLayer({ rotate }: { rotate?: number }) {
  return (
    <>
      <div
        className="rope-band__layer"
        style={{
          backgroundImage: `url(${ROPE_URL})`,
          transform: rotate ? `rotate(${rotate}deg) scale(1.02)` : undefined,
        }}
      />
      <div
        className="rope-band__layer"
        style={{
          backgroundImage: `url(${ROPE_URL})`,
          transform: rotate ? `rotate(${rotate}deg) scale(1.04) translate(1px, 1px)` : 'translate(1px, 0)',
          opacity: 0.85,
        }}
      />
      <div
        className="rope-band__layer"
        style={{
          backgroundImage: `url(${ROPE_URL})`,
          transform: rotate ? `rotate(${rotate}deg) scale(1.06) translate(-1px, 1px)` : 'translate(-1px, 1px)',
          opacity: 0.7,
        }}
      />
    </>
  )
}

export function RopeWrap({
  active,
  showKnot,
}: {
  active: boolean
  showKnot: boolean
}) {
  const reduced = shouldReduceMotion()
  const d = (ms: number) => motionDuration(ms) || 0.01

  if (!active && !showKnot) return null

  if (reduced && showKnot) {
    return (
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <img
          alt=""
          src={ROPE_URL}
          draggable={false}
          className="rope-knot h-[70%] w-[70%] max-w-[220px] select-none object-contain opacity-95"
        />
      </div>
    )
  }

  return (
    <>
      {active ? (
        <>
          <motion.div
            className="rope-band absolute left-[8%] right-[8%] top-[42%] h-10 origin-center"
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ ...SPRING, delay: d(0) }}
          >
            <RopeBandLayer />
          </motion.div>

          <motion.div
            className="rope-band absolute bottom-[18%] left-[38%] top-[18%] w-10 origin-center"
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            transition={{ ...SPRING, delay: d(0.15) }}
          >
            <RopeBandLayer />
          </motion.div>

          <motion.div
            className="rope-band absolute inset-[12%] origin-center"
            style={{ rotate: -18 }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...SPRING, delay: d(0.32) }}
          >
            <RopeBandLayer rotate={-18} />
          </motion.div>

          <motion.div
            className="rope-band absolute inset-[10%] origin-center"
            style={{ rotate: 22 }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...SPRING, delay: d(0.48) }}
          >
            <RopeBandLayer rotate={22} />
          </motion.div>
        </>
      ) : null}

      {showKnot ? (
        <motion.div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: 0.95, scale: [0.88, 1.04, 1] }}
          transition={{
            opacity: { duration: d(0.35) },
            scale: { duration: d(0.5), ease: [0.2, 0.8, 0.2, 1] },
          }}
        >
          <img
            alt=""
            src={ROPE_URL}
            draggable={false}
            className="rope-knot h-[72%] w-[72%] max-w-[240px] select-none object-contain"
          />
        </motion.div>
      ) : null}
    </>
  )
}

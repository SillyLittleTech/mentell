import { useMemo, type CSSProperties } from "react";
import { shouldReduceMotion } from "../../shared/motion/useMotionPrefs";

type Piece = {
  id: number;
  left: number;
  delayMs: number;
  durationMs: number;
  rotate: number;
  drift: number;
  color: string;
  w: number;
  h: number;
  round: boolean;
};

const CONFETTI_COLORS = [
  "#2a9b58",
  "#3fbf6a",
  "#d6bd40",
  "#f0d84a",
  "#c61d1d",
  "#e85d5d",
  "#5c4033",
  "#8b7355",
];

/** Full-viewport confetti shower; one-shot per `burstKey`. */
export function ConfettiBurst({ burstKey }: { burstKey: number }) {
  const reduced = shouldReduceMotion();

  const pieces = useMemo(() => {
    if (reduced) return [];
    const count = 52;
    const next: Piece[] = [];
    for (let i = 0; i < count; i++) {
      next.push({
        id: burstKey * 1000 + i,
        left: 8 + Math.random() * 84,
        delayMs: Math.random() * 420,
        durationMs: 2200 + Math.random() * 1400,
        rotate: Math.random() * 360,
        drift: -48 + Math.random() * 96,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
        w: 5 + Math.random() * 5,
        h: 7 + Math.random() * 9,
        round: Math.random() > 0.55,
      });
    }
    return next;
  }, [burstKey, reduced]);

  if (reduced || pieces.length === 0) return null;

  return (
    <div className="confetti-layer pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={
            {
              left: `${p.left}%`,
              width: p.w,
              height: p.h,
              background: p.color,
              borderRadius: p.round ? "999px" : "1px",
              "--confetti-delay": `${p.delayMs}ms`,
              "--confetti-duration": `${p.durationMs}ms`,
              "--confetti-rotate": `${p.rotate}deg`,
              "--confetti-drift": `${p.drift}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

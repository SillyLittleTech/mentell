import { useMemo } from "react";
import { shouldReduceMotion } from "../../shared/motion/useMotionPrefs";

function heatGradient(display: number) {
  if (display >= 4)
    return "linear-gradient(180deg, rgba(42,155,88,0.95), rgba(100,200,140,0.7))";
  if (display === 3)
    return "linear-gradient(180deg, rgba(214,189,64,0.95), rgba(240,220,120,0.65))";
  if (display === 2)
    return "linear-gradient(180deg, rgba(230,150,48,0.95), rgba(255,200,100,0.6))";
  if (display === 1)
    return "linear-gradient(180deg, rgba(198,29,29,0.85), rgba(240,120,80,0.55))";
  return "linear-gradient(180deg, rgba(90,90,90,0.25), rgba(140,140,140,0.15))";
}

export function HbcmDisplay({
  hbcmDisplay,
  pulse,
  variant = "chip",
}: {
  hbcmDisplay: number;
  pulse?: boolean;
  variant?: "chip" | "inline";
}) {
  const reduced = shouldReduceMotion();
  const display = Math.min(5, Math.max(0, Math.round(hbcmDisplay)));
  const label =
    display === 0
      ? "Consistency heat empty — dust settles; the next log refills the glass."
      : `Consistency heat ${display} of 5 (rounded up for a little extra grace)`;

  const fillPct = useMemo(() => Math.min(100, (display / 5) * 100), [display]);

  return (
    <div
      className={
        variant === "chip"
          ? `hbcm-chip flex items-center gap-2 rounded-2xl border border-[var(--paper-border)] px-3 py-2 ${pulse && !reduced ? "hbcm-chip--pulse" : ""}`
          : "hbcm-inline flex flex-col gap-1"
      }
      role="img"
      aria-label={label}
    >
      {variant === "chip" ? (
        <div className="ink-muted text-[11px] font-semibold uppercase tracking-wide">
          HBCM
        </div>
      ) : (
        <div className="ink-muted text-xs">Heat-based consistency</div>
      )}
      <div
        className="relative flex h-11 w-9 items-end justify-center overflow-hidden rounded-lg border border-black/20 bg-white/30 shadow-inner dark:bg-black/25"
        style={{ backdropFilter: "blur(6px)" }}
      >
        <div
          className="absolute bottom-0 left-0 right-0 transition-[height] duration-300"
          style={{
            height: `${fillPct}%`,
            background: heatGradient(display),
            opacity: display === 0 ? 0.35 : 1,
          }}
        />
        <span
          className="relative z-[1] font-mono text-lg font-bold tabular-nums text-[rgba(0,0,0,0.88)] dark:text-[rgba(255,255,255,0.92)]"
          style={{ textShadow: "0 1px 0 rgba(255,255,255,0.35)" }}
        >
          {display}
        </span>
        {display === 0 ? (
          <span
            className="pointer-events-none absolute inset-0 opacity-40"
            aria-hidden
          >
            <svg viewBox="0 0 36 44" className="h-full w-full">
              <path
                d="M4 8 Q18 4 30 10 M6 36 Q16 40 28 34"
                fill="none"
                stroke="rgba(0,0,0,0.25)"
                strokeWidth="0.6"
              />
            </svg>
          </span>
        ) : null}
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

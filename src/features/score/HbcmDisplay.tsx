import { useId, useMemo } from "react";
import { shouldReduceMotion } from "../../shared/motion/useMotionPrefs";
import { MaterialIcon } from "../../components/MaterialIcon";

function fillRatio(display: number): number {
  switch (display) {
    case 5:
      return 0.88;
    case 4:
      return 0.72;
    case 3:
      return 0.5;
    case 2:
      return 0.26;
    case 1:
      return 0.1;
    default:
      return 0;
  }
}

function liquidGradient(display: number) {
  switch (display) {
    case 5:
      return { a: "rgb(34,165,95)", b: "rgb(130,225,160)" };
    case 4:
      return { a: "rgb(42,155,88)", b: "rgb(205,215,85)" };
    case 3:
      return { a: "rgb(200,190,65)", b: "rgb(235,215,95)" };
    case 2:
      return { a: "rgb(215,110,38)", b: "rgb(245,175,88)" };
    case 1:
      return { a: "rgb(185,32,32)", b: "rgb(235,95,68)" };
    default:
      return { a: "rgba(130,130,138,0.2)", b: "rgba(170,170,178,0.12)" };
  }
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
  const uid = useId().replace(/:/g, "");
  const clipId = `hbcm-clip-${uid}`;
  const gradId = `hbcm-liq-${uid}`;

  const fill = fillRatio(display);
  const { a, b } = liquidGradient(display);
  const label =
    display === 0
      ? "Consistency heat empty. Next log starts filling the glass."
      : `Consistency heat ${display} of five`;

  const svgH = variant === "chip" ? 48 : 54;
  const svgW = variant === "chip" ? 52 : 58;
  const fontSize = variant === "chip" ? 34 : 40;
  const baselineY = svgH * 0.78;

  const waveStyle = useMemo(
    () =>
      reduced
        ? undefined
        : { animation: "hbcm-liq-wave-x 2.8s ease-in-out infinite" },
    [reduced],
  );

  const chipClass = [
    variant === "chip"
      ? "rounded-2xl border border-[var(--paper-border)] px-3 py-2"
      : "",
    "flex items-center gap-2",
    pulse && !reduced ? "hbcm-chip--pulse" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={chipClass} role="img" aria-label={label}>
      <MaterialIcon
        name="whatshot"
        size={variant === "chip" ? 18 : 20}
        accent={false}
        className="shrink-0 opacity-75"
      />
      <div className="relative" style={{ width: svgW, height: svgH }}>
        <svg
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="overflow-visible text-[var(--paper-ink)] dark:text-white"
          aria-hidden
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor={a} />
              <stop offset="100%" stopColor={b} />
            </linearGradient>
            <clipPath id={clipId}>
              <text
                x={svgW / 2}
                y={baselineY}
                textAnchor="middle"
                fontFamily='Georgia, "Times New Roman", serif'
                fontWeight="700"
                fontSize={fontSize}
                fontStyle="italic"
              >
                {display}
              </text>
            </clipPath>
          </defs>

          <g clipPath={`url(#${clipId})`}>
            {display > 0 ? (
              <g style={waveStyle}>
                <rect
                  x="-8%"
                  y={svgH * (1 - fill)}
                  width="116%"
                  height={svgH * fill + 8}
                  fill={`url(#${gradId})`}
                />
                <ellipse
                  cx={svgW * 0.5}
                  cy={svgH * (1 - fill)}
                  rx={svgW * 0.52}
                  ry={svgH * 0.04}
                  fill="rgba(255,255,255,0.2)"
                />
              </g>
            ) : (
              <>
                <rect
                  x="0"
                  y="0"
                  width={svgW}
                  height={svgH}
                  fill="rgba(155,155,165,0.08)"
                />
                <path
                  d={`M ${svgW * 0.12} ${svgH * 0.22} Q ${svgW * 0.5} ${svgH * 0.14} ${svgW * 0.88} ${svgH * 0.24}`}
                  fill="none"
                  stroke="rgba(0,0,0,0.2)"
                  strokeWidth="0.45"
                  className="dark:stroke-[rgba(255,255,255,0.28)]"
                />
                <path
                  d={`M ${svgW * 0.18} ${svgH * 0.9} Q ${svgW * 0.5} ${svgH * 0.97} ${svgW * 0.82} ${svgH * 0.88}`}
                  fill="none"
                  stroke="rgba(0,0,0,0.16)"
                  strokeWidth="0.38"
                  className="dark:stroke-[rgba(255,255,255,0.22)]"
                />
              </>
            )}
          </g>

          <text
            x={svgW / 2}
            y={baselineY}
            textAnchor="middle"
            fill="currentColor"
            className="opacity-95 dark:[stroke:rgba(248,248,252,0.35)]"
            stroke="rgba(30,30,38,0.42)"
            strokeWidth="1.05"
            fontFamily='Georgia, "Times New Roman", serif'
            fontWeight="700"
            fontSize={fontSize}
            fontStyle="italic"
            style={{ paintOrder: "stroke fill" }}
          >
            {display}
          </text>
        </svg>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

import { useId } from "react";
import { shouldReduceMotion } from "../../shared/motion/useMotionPrefs";
import { MaterialIcon } from "../../components/MaterialIcon";

/** Documents `fillRatio` in this module. */
/** Liquid height inside the digit — even steps; only 0 stays empty. */
function fillRatio(display: number): number {
  switch (display) {
    case 5:
      return 0.96;
    case 4:
      return 0.76;
    case 3:
      return 0.56;
    case 2:
      return 0.38;
    case 1:
      return 0.22;
    default:
      return 0;
  }
}

/** Documents `liquidGradient` in this module. */
function liquidGradient(display: number) {
  switch (display) {
    case 5:
      return { a: "rgb(18,150,78)", b: "rgb(95,235,155)" };
    case 4:
      return { a: "rgb(95,140,42)", b: "rgb(225,210,70)" };
    case 3:
      return { a: "rgb(200,190,65)", b: "rgb(235,215,95)" };
    case 2:
      return { a: "rgb(215,110,38)", b: "rgb(245,175,88)" };
    case 1:
      return { a: "rgb(185,32,32)", b: "rgb(235,95,68)" };
    default:
      return { a: "rgba(120,120,130,0.35)", b: "rgba(160,160,170,0.2)" };
  }
}

/** Consistency heat numeral with optional glass vessel + animated liquid fill. */
type HbcmDisplayProps = {
  readonly hbcmDisplay: number;
  readonly pulse?: boolean;
  readonly variant?: "chip" | "inline";
};

/** Documents `HbcmDisplay` in this module. */
export function HbcmDisplay({
  hbcmDisplay,
  pulse,
  variant = "chip",
}: HbcmDisplayProps) {
  const reduced = shouldReduceMotion();
  const display = Math.min(5, Math.max(0, Math.round(hbcmDisplay)));
  const uid = useId().replaceAll(":", "");
  const liquidClipId = `hbcm-liq-clip-${uid}`;
  const gradId = `hbcm-liq-grad-${uid}`;

  const fill = fillRatio(display);
  const { a, b } = liquidGradient(display);
  const label =
    display === 0
      ? "Consistency heat empty. Next log starts filling the glass."
      : `Consistency heat ${display} of five`;

  const svgH = variant === "chip" ? 34 : 40;
  const svgW = variant === "chip" ? 30 : 36;
  const fontSize = variant === "chip" ? 26 : 31;
  const baselineY = svgH * 0.82;

  const chipClass = [
    "flex items-center gap-2",
    pulse && !reduced ? "hbcm-chip--pulse" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const liqH = Math.max(0, svgH * fill * 1.14);
  const liqY = svgH - liqH + 0.5;
  const surfaceY = liqY;

  const iconSize = variant === "chip" ? 18 : 20;

  return (
    <div className={chipClass} role="img" aria-label={label}>
      <MaterialIcon
        name="whatshot"
        size={iconSize}
        accent={false}
        className="shrink-0 opacity-70"
      />
      <div
        className="relative flex items-center justify-center"
        style={{ width: svgW, height: svgH }}
      >
        <svg
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="block overflow-visible"
          aria-hidden
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor={a} />
              <stop offset="100%" stopColor={b} />
            </linearGradient>
            <clipPath id={liquidClipId}>
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

          {/* Liquid fills the glyph from below; clipped to digit shape */}
          <g clipPath={`url(#${liquidClipId})`}>
            {display > 0 ? (
              <>
                <g className={reduced ? undefined : "hbcm-liq-wave"}>
                  <rect
                    x="-25%"
                    y={liqY - 2}
                    width="150%"
                    height={liqH + 8}
                    fill={`url(#${gradId})`}
                  />
                  <ellipse
                    cx={svgW * 0.52}
                    cy={surfaceY}
                    rx={svgW * 0.62}
                    ry={svgH * 0.07}
                    fill="rgba(255,255,255,0.28)"
                  />
                </g>
                {!reduced ? (
                  <g className="hbcm-liq-wave hbcm-liq-wave--shimmer">
                    <ellipse
                      cx={svgW * 0.48}
                      cy={surfaceY + 1.5}
                      rx={svgW * 0.35}
                      ry={svgH * 0.04}
                      fill="rgba(255,255,255,0.35)"
                    />
                  </g>
                ) : null}
              </>
            ) : (
              <rect
                x="0"
                y={svgH * 0.55}
                width={svgW}
                height={svgH * 0.45}
                fill="rgba(150,150,160,0.07)"
              />
            )}
          </g>

          {/* Glass numeral on top — liquid is underneath (see clipPath group above) */}
          <text
            x={svgW / 2}
            y={baselineY}
            textAnchor="middle"
            className="hbcm-glass-digit"
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

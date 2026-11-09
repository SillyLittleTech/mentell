import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { motion } from "framer-motion";
import {
  motionDuration,
  shouldReduceMotion,
} from "../../shared/motion/useMotionPrefs";
import { MaterialIcon } from "../../components/MaterialIcon";
import {
  hbcmFillRatio,
  hbcmLiquidPalette,
  hbcmTileFillRatio,
} from "./hbcmVisual";
import {
  getStreakFireLevel,
  getStreakFlameCount,
  streakFlickerDuration,
} from "./streakFireLevel";
import { HbcmTileWaves } from "./HbcmTileWaves";

const FLAME_OFFSETS = [
  { top: -7, right: 4 },
  { top: -5, right: 20 },
  { top: 0, right: -4 },
] as const;

type Bubble = {
  id: number;
  cx: number;
  r: number;
  delayMs: number;
  durationMs: number;
};

type TileBubble = {
  id: number;
  leftPct: number;
  size: number;
  delayMs: number;
  durationMs: number;
};

type HbcmDisplayProps = {
  readonly hbcmDisplay: number;
  /** Hidden consecutive-day log streak; fire chrome only (not heat 0–5). */
  readonly logStreak?: number;
  readonly pulse?: boolean;
  readonly variant?: "chip" | "inline";
};

let bubbleIdSeq = 0;

/** Consistency heat chip: subtle liquid tile + glass numeral with occasional bubbles. */
export function HbcmDisplay({
  hbcmDisplay,
  logStreak = 0,
  pulse,
  variant = "chip",
}: HbcmDisplayProps) {
  const reduced = shouldReduceMotion();
  const display = Math.min(5, Math.max(0, Math.round(hbcmDisplay)));
  const uid = useId().replaceAll(":", "");
  const liquidClipId = `hbcm-liq-clip-${uid}`;
  const gradId = `hbcm-liq-grad-${uid}`;
  const bubblesClipId = `hbcm-bubbles-clip-${uid}`;

  const fill = hbcmFillRatio(display);
  const tileFill = hbcmTileFillRatio(display);
  const palette = hbcmLiquidPalette(display);
  const fireLevel = getStreakFireLevel(logStreak);
  const displayFireLevel =
    pulse && !reduced ? Math.min(6, fireLevel + 1) : fireLevel;
  const flameCount = getStreakFlameCount(displayFireLevel);
  const flickerSec = streakFlickerDuration(displayFireLevel);
  const label =
    display === 0
      ? "Consistency heat empty. Next log starts filling the glass."
      : `Consistency heat ${display} of five. Tap to pop bubbles.`;

  const svgH = variant === "chip" ? 34 : 40;
  const svgW = variant === "chip" ? 30 : 36;
  const fontSize = variant === "chip" ? 26 : 31;
  const baselineY = svgH * 0.82;

  const liqH = Math.max(0, svgH * fill * 1.12);
  const liqY = svgH - liqH + 0.5;
  const surfaceY = liqY;

  const iconSize = variant === "chip" ? 18 : 20;

  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [tileBubbles, setTileBubbles] = useState<TileBubble[]>([]);
  const [burstAll, setBurstAll] = useState(false);
  const [tileBurst, setTileBurst] = useState(false);
  const burstTimer = useRef<number | null>(null);

  const spawnBubble = useCallback(() => {
    if (display === 0) return;
    const cx = svgW * (0.22 + Math.random() * 0.56);
    const r = 1.1 + Math.random() * 1.8;
    const b: Bubble = {
      id: bubbleIdSeq++,
      cx,
      r,
      delayMs: 0,
      durationMs: 2200 + Math.random() * 1400,
    };
    setBubbles((prev) => [...prev, b].slice(-8));
  }, [display, svgW]);

  const spawnTileBubble = useCallback(() => {
    if (display === 0) return;
    const b: TileBubble = {
      id: bubbleIdSeq++,
      leftPct: 12 + Math.random() * 76,
      size: 5 + Math.random() * 7,
      delayMs: 0,
      durationMs: 2400 + Math.random() * 1800,
    };
    setTileBubbles((prev) => [...prev, b].slice(-10));
  }, [display]);

  useEffect(() => {
    if (reduced || display === 0) return;
    const first = window.setTimeout(spawnBubble, 400 + Math.random() * 800);
    const interval = window.setInterval(
      () => spawnBubble(),
      2600 + Math.random() * 2200,
    );
    const tileFirst = window.setTimeout(
      spawnTileBubble,
      200 + Math.random() * 600,
    );
    const tileInterval = window.setInterval(
      () => spawnTileBubble(),
      1800 + Math.random() * 1400,
    );
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
      window.clearTimeout(tileFirst);
      window.clearInterval(tileInterval);
    };
  }, [display, reduced, spawnBubble, spawnTileBubble]);

  const onTileActivate = () => {
    if (display === 0) return;
    const popDigit: Bubble[] = [];
    const popTile: TileBubble[] = [];
    for (let i = 0; i < 8; i++) {
      popDigit.push({
        id: bubbleIdSeq++,
        cx: svgW * (0.15 + Math.random() * 0.7),
        r: 1.4 + Math.random() * 2.2,
        delayMs: 0,
        durationMs: 400,
      });
      popTile.push({
        id: bubbleIdSeq++,
        leftPct: 8 + Math.random() * 84,
        size: 6 + Math.random() * 10,
        delayMs: i * 18,
        durationMs: 520,
      });
    }
    setBubbles(popDigit);
    setTileBubbles((prev) => [...prev, ...popTile].slice(-16));
    setBurstAll(true);
    setTileBurst(true);
    if (burstTimer.current) window.clearTimeout(burstTimer.current);
    burstTimer.current = window.setTimeout(() => {
      setBurstAll(false);
      setTileBurst(false);
      setBubbles([]);
      setTileBubbles([]);
    }, 520);
  };

  const levelTransition = {
    duration: reduced ? 0 : motionDuration(0.55) || 0.55,
    ease: [0.33, 1, 0.68, 1] as const,
  };

  const tileStyle = {
    "--hbcm-tile-fill": String(tileFill),
    "--hbcm-tile-a": palette.tileDeep,
    "--hbcm-tile-b": palette.tileBright,
    "--hbcm-tile-ring": palette.tileRing,
    "--hbcm-tile-glow": palette.tileGlow,
  } as CSSProperties;

  const digitBoxStyle = {
    width: svgW,
    height: svgH,
    "--hbcm-svg-h": `${svgH}px`,
  } as CSSProperties;

  const digit = (
    <div
      className="relative flex items-center justify-center"
      style={digitBoxStyle}
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
            <motion.stop
              offset="0%"
              animate={{ stopColor: palette.deep }}
              transition={levelTransition}
            />
            <motion.stop
              offset="100%"
              animate={{ stopColor: palette.bright }}
              transition={levelTransition}
            />
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
          <clipPath id={bubblesClipId}>
            <rect x="0" y={svgH * 0.12} width={svgW} height={svgH * 0.88} />
          </clipPath>
        </defs>

        <g clipPath={`url(#${liquidClipId})`}>
          {display > 0 ? (
            <g
              className={
                reduced ? undefined : "hbcm-digit-wave hbcm-liq-wave--digit"
              }
            >
              <motion.rect
                x="-25%"
                width="150%"
                fill={`url(#${gradId})`}
                animate={{ y: liqY - 2, height: liqH + 8 }}
                transition={levelTransition}
              />
              <motion.ellipse
                cx={svgW * 0.52}
                rx={svgW * 0.58}
                ry={svgH * 0.06}
                fill="rgba(255,255,255,0.32)"
                animate={{ cy: surfaceY }}
                transition={levelTransition}
              />
            </g>
          ) : (
            <rect
              x="0"
              y={svgH * 0.58}
              width={svgW}
              height={svgH * 0.42}
              fill="rgba(150,150,160,0.09)"
            />
          )}

          {display > 0 && !reduced ? (
            <g clipPath={`url(#${bubblesClipId})`}>
              {bubbles.map((b) => (
                <circle
                  key={b.id}
                  className={
                    burstAll
                      ? "hbcm-bubble hbcm-bubble--burst"
                      : "hbcm-bubble hbcm-bubble--rise"
                  }
                  cx={b.cx}
                  cy={svgH * 0.9}
                  r={b.r}
                  style={{
                    animationDuration: `${b.durationMs}ms`,
                    animationDelay: `${b.delayMs}ms`,
                  }}
                  onAnimationEnd={() => {
                    if (!burstAll) {
                      setBubbles((prev) => prev.filter((x) => x.id !== b.id));
                    }
                  }}
                />
              ))}
            </g>
          ) : null}
        </g>

        <text
          x={svgW / 2}
          y={baselineY}
          textAnchor="middle"
          className="hbcm-glass-digit"
          strokeWidth="1.35"
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
  );

  if (variant === "inline") {
    return (
      <div className="flex items-center gap-2" role="img" aria-label={label}>
        <MaterialIcon
          name="whatshot"
          size={iconSize}
          accent={false}
          className="shrink-0 opacity-70"
        />
        {digit}
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  const tileChromeStyle =
    !reduced && flameCount > 0
      ? ({ "--streak-flicker-duration": `${flickerSec}s` } as CSSProperties)
      : undefined;

  return (
    <button
      type="button"
      className={[
        "hbcm-heat-tile focus-ring relative flex items-center gap-2 overflow-hidden",
        pulse && !reduced ? "hbcm-chip--pulse" : "",
        tileBurst && !reduced ? "hbcm-heat-tile--bubble-burst" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ ...tileStyle, ...tileChromeStyle }}
      data-hbcm-fire-level={String(displayFireLevel)}
      aria-label={label}
      onClick={onTileActivate}
    >
      <div
        className="hbcm-heat-tile__wash pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        {tileFill > 0 ? (
          <div className="hbcm-heat-tile__pool">
            <div
              className={
                reduced ? "hbcm-heat-tile__liquid" : "hbcm-heat-tile__liquid"
              }
            />
            <HbcmTileWaves palette={palette} reduced={reduced} />
            {!reduced ? (
              <div className="hbcm-heat-tile__surface hbcm-tile-crest" />
            ) : null}
            {display > 0 && !reduced ? (
              <div className="hbcm-heat-tile__bubbles">
                {tileBubbles.map((b) => (
                  <span
                    key={b.id}
                    className={
                      tileBurst
                        ? "hbcm-tile-bubble hbcm-tile-bubble--burst"
                        : "hbcm-tile-bubble hbcm-tile-bubble--rise"
                    }
                    style={{
                      left: `${b.leftPct}%`,
                      width: b.size,
                      height: b.size,
                      animationDuration: `${b.durationMs}ms`,
                      animationDelay: `${b.delayMs}ms`,
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {flameCount > 0
        ? FLAME_OFFSETS.slice(0, flameCount).map((pos, i) => (
            <span
              key={i}
              className={`streak-flame streak-flame--${i + 1} ${
                reduced ? "" : "streak-flame--animated"
              }`}
              style={pos}
              aria-hidden
            >
              🔥
            </span>
          ))
        : null}
      {displayFireLevel >= 3 && displayFireLevel < 4 ? (
        <span className="streak-spark" aria-hidden>
          ✨
        </span>
      ) : null}

      <MaterialIcon
        name="whatshot"
        size={iconSize}
        accent={false}
        className="relative z-[1] shrink-0 opacity-80"
      />
      <div className="relative z-[1]">{digit}</div>
      <span className="sr-only">{label}</span>
    </button>
  );
}

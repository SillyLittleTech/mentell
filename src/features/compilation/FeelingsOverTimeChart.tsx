import { useCallback, useId, useMemo, useState } from "react";
import type { FeelingPoint } from "./feelingsOverTimeData";
import type { FeelingDayClass } from "./feelingsSemantics";
import { chartRgbForClass } from "../shop/weeklyProgressColors";

const CLASS_COLORS: Record<FeelingDayClass, { stroke: string; fill: string }> =
  {
    positive: {
      stroke: chartRgbForClass("positive"),
      fill: chartRgbForClass("positive"),
    },
    neutral: {
      stroke: chartRgbForClass("neutral"),
      fill: chartRgbForClass("neutral"),
    },
    negative: {
      stroke: chartRgbForClass("negative"),
      fill: chartRgbForClass("negative"),
    },
    missed: {
      stroke: chartRgbForClass("missed"),
      fill: chartRgbForClass("missed"),
    },
    no_data: {
      stroke: chartRgbForClass("no_data"),
      fill: chartRgbForClass("no_data"),
    },
  };

function mix(a: string, b: string, t: number) {
  const pa = a.match(/\d+/g)?.map(Number) ?? [0, 0, 0];
  const pb = b.match(/\d+/g)?.map(Number) ?? [0, 0, 0];
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

function yForClass(c: FeelingDayClass, h: number) {
  switch (c) {
    case "positive":
      return h * 0.18;
    case "neutral":
      return h * 0.42;
    case "negative":
      return h * 0.68;
    case "missed":
      return h * 0.88;
    default:
      return h * 0.95;
  }
}

/** SVG feelings-over-time chart with interactive dots (Projector + UI playground). */
export function FeelingsOverTimeChart({
  points,
  titleId,
}: {
  points: FeelingPoint[];
  titleId: string;
}) {
  const gridId = useId();
  const [active, setActive] = useState<number | null>(null);

  const { polySegments, dotPts, w, h } = useMemo(() => {
    const width = 560;
    const height = 220;
    const padding = 36;
    if (!points.length) {
      return {
        polySegments: [] as { d: string; stroke: string }[],
        dotPts: [],
        w: width,
        h: height,
        pad: padding,
      };
    }
    const innerW = width - padding * 2;
    const innerH = height - padding * 2;
    const n = points.length;
    const step = n <= 1 ? 0 : innerW / (n - 1);

    const dotPts = points.map((p, i) => ({
      i,
      cx: padding + i * step,
      cy: padding + yForClass(p.class, innerH),
      p,
    }));

    const polySegments: { d: string; stroke: string }[] = [];
    for (let i = 0; i < dotPts.length - 1; i++) {
      const a = dotPts[i];
      const b = dotPts[i + 1];
      const ca = CLASS_COLORS[a.p.class].stroke;
      const cb = CLASS_COLORS[b.p.class].stroke;
      const stroke = mix(ca, cb, 0.5);
      polySegments.push({
        d: `M ${a.cx} ${a.cy} L ${b.cx} ${b.cy}`,
        stroke,
      });
    }

    return { polySegments, dotPts, w: width, h: height, pad: padding };
  }, [points]);

  const describePoint = useCallback((p: FeelingPoint) => {
    const kind =
      p.class === "positive"
        ? "Positive"
        : p.class === "negative"
          ? "Difficult"
          : p.class === "neutral"
            ? "Mixed or steady"
            : p.class === "missed"
              ? "Missed day"
              : "No data";
    const note = p.note ? ` · ${p.note}` : "";
    return `${p.dateKey}: ${kind}${note}`;
  }, []);

  if (!points.length) {
    return (
      <div
        className="ink-muted rounded-2xl border border-[var(--paper-border)] p-6 text-sm"
        role="region"
        aria-labelledby={titleId}
      >
        No entries in this range yet.
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-[var(--paper-border)] p-3"
      role="region"
      aria-labelledby={titleId}
    >
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-auto w-full max-w-full"
        aria-hidden={false}
      >
        <defs>
          <pattern
            id={`${gridId}-gear`}
            width="12"
            height="12"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M0 6 L12 6 M6 0 L6 12"
              stroke="var(--paper-border)"
              strokeWidth="0.5"
              opacity="0.35"
            />
          </pattern>
        </defs>
        <rect
          x="0"
          y="0"
          width={w}
          height={h}
          fill={`url(#${gridId}-gear)`}
          opacity={0.25}
        />
        {polySegments.map((seg) => (
          <path
            key={seg.d}
            d={seg.d}
            stroke={seg.stroke}
            strokeWidth={2.5}
            fill="none"
            strokeLinecap="round"
          />
        ))}
        {dotPts.map(({ cx, cy, p, i }) => {
          const col = CLASS_COLORS[p.class];
          const focus = active === i;
          return (
            <g key={p.dateKey}>
              <circle
                cx={cx}
                cy={cy}
                r={focus ? 9 : 6}
                fill={col.fill}
                stroke="var(--paper-bg)"
                strokeWidth={2}
                className="cursor-pointer focus:outline-none"
                tabIndex={0}
                role="button"
                aria-label={describePoint(p)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
              />
            </g>
          );
        })}
      </svg>
      {active !== null && points[active] ? (
        <div className="mt-2 rounded-xl border border-[var(--paper-border)] bg-[var(--paper-bg)] px-3 py-2 text-sm">
          <div className="font-medium">{points[active].dateKey}</div>
          <div className="ink-muted">{describePoint(points[active])}</div>
        </div>
      ) : null}
    </div>
  );
}

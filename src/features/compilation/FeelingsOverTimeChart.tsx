import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type { FeelingPoint } from "./feelingsOverTimeData";
import type { FeelingDayClass } from "./feelingsSemantics";
import { chartRgbForClass } from "../shop/weeklyProgressColors";
import {
  emotionTooltipLine,
  feelingClassLabel,
  sentimentTooltipLabel,
} from "./feelingsChartTooltip";

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

const TOOLTIP_OFFSET = 14;
const TOOLTIP_WIDTH = 240;

/** Documents `mix` in this module. */
function mix(a: string, b: string, t: number) {
  const pa = a.match(/\d+/g)?.map(Number) ?? [0, 0, 0];
  const pb = b.match(/\d+/g)?.map(Number) ?? [0, 0, 0];
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

/** Documents `yForClass` in this module. */
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

type TooltipPos = { x: number; y: number };

/** SVG feelings-over-time chart with interactive dots (Projector + UI playground). */
export function FeelingsOverTimeChart({
  points,
  titleId,
  onPointClick,
}: {
  points: FeelingPoint[];
  titleId: string;
  /** Opens projector entry preview when the day has a journal or quick log. */
  onPointClick?: (point: FeelingPoint) => void;
}) {
  const gridId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [tooltipAt, setTooltipAt] = useState<TooltipPos | null>(null);

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
    const kind = feelingClassLabel(p.class);
    const sent = sentimentTooltipLabel(p.sentiment);
    const parts = [p.label || p.dateKey, kind];
    if (sent) parts.push(sent);
    if (p.situation) parts.push(p.situation);
    return parts.join(" · ");
  }, []);

  const clampTooltip = useCallback((clientX: number, clientY: number) => {
    const margin = 8;
    const maxX = window.innerWidth - TOOLTIP_WIDTH - margin;
    let x = clientX + TOOLTIP_OFFSET;
    let y = clientY + TOOLTIP_OFFSET;
    if (x > maxX) x = clientX - TOOLTIP_WIDTH - TOOLTIP_OFFSET;
    if (y > window.innerHeight - 120) y = clientY - 110;
    return { x: Math.max(margin, x), y: Math.max(margin, y) };
  }, []);

  const onWrapMove = useCallback(
    (e: ReactMouseEvent) => {
      if (hovered === null) return;
      setTooltipAt(clampTooltip(e.clientX, e.clientY));
    },
    [clampTooltip, hovered],
  );

  const activate = useCallback(
    (index: number, clientX: number, clientY: number) => {
      setHovered(index);
      setTooltipAt(clampTooltip(clientX, clientY));
    },
    [clampTooltip],
  );

  const deactivate = useCallback(() => {
    setHovered(null);
    setTooltipAt(null);
  }, []);

  const hoveredPoint = hovered !== null ? points[hovered] : null;

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
      ref={wrapRef}
      className="relative rounded-2xl border border-[var(--paper-border)] p-3"
      role="region"
      aria-labelledby={titleId}
      onMouseMove={onWrapMove}
      onMouseLeave={deactivate}
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
          const focus = hovered === i;
          const clickable = Boolean(p.entryId && onPointClick);
          return (
            <g key={p.dateKey}>
              <circle
                cx={cx}
                cy={cy}
                r={focus ? 9 : 6}
                fill={col.fill}
                stroke="var(--paper-bg)"
                strokeWidth={2}
                className={
                  clickable
                    ? "cursor-pointer focus:outline-none"
                    : "focus:outline-none"
                }
                tabIndex={0}
                role={clickable ? "button" : undefined}
                aria-label={describePoint(p)}
                onFocus={(e) => {
                  const rect = (
                    e.target as SVGCircleElement
                  ).getBoundingClientRect();
                  activate(i, rect.left + rect.width / 2, rect.top);
                }}
                onBlur={deactivate}
                onMouseEnter={(e) => activate(i, e.clientX, e.clientY)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (p.entryId && onPointClick) onPointClick(p);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (p.entryId && onPointClick) onPointClick(p);
                  }
                }}
              />
            </g>
          );
        })}
      </svg>

      {hoveredPoint && tooltipAt ? (
        <div
          className="pointer-events-none fixed z-50 w-[min(92vw,15rem)] rounded-xl border border-[var(--paper-border)] bg-[var(--paper-bg)] px-3 py-2 text-sm shadow-lg"
          style={{ left: tooltipAt.x, top: tooltipAt.y }}
          role="tooltip"
        >
          <div className="font-medium">{hoveredPoint.label}</div>
          <div className="ink-muted text-xs">{hoveredPoint.dateKey}</div>
          <dl className="mt-2 space-y-1 text-xs">
            <div className="flex gap-2">
              <dt className="ink-muted shrink-0">Day</dt>
              <dd>{feelingClassLabel(hoveredPoint.class)}</dd>
            </div>
            {sentimentTooltipLabel(hoveredPoint.sentiment) ? (
              <div className="flex gap-2">
                <dt className="ink-muted shrink-0">Sentiment</dt>
                <dd>{sentimentTooltipLabel(hoveredPoint.sentiment)}</dd>
              </div>
            ) : null}
            {emotionTooltipLine(hoveredPoint) ? (
              <div className="flex gap-2">
                <dt className="ink-muted shrink-0">Emotion</dt>
                <dd className="min-w-0 break-words">
                  {emotionTooltipLine(hoveredPoint)}
                </dd>
              </div>
            ) : null}
            {hoveredPoint.situation ? (
              <div className="flex gap-2">
                <dt className="ink-muted shrink-0">Situation</dt>
                <dd className="min-w-0 line-clamp-3 break-words">
                  {hoveredPoint.situation}
                </dd>
              </div>
            ) : null}
          </dl>
          {hoveredPoint.entryId && onPointClick ? (
            <div className="ink-muted mt-2 border-t border-[var(--paper-border)] pt-2 text-[11px]">
              Click to open entry
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

import { useId, type CSSProperties } from "react";
import type { ShopWeekDay } from "./shopWeeklyProgress";
import type { FeelingDayClass } from "../compilation/feelingsSemantics";
import {
  pastelBorderRgb,
  pastelFillRgb,
  pastelSegmentRgb,
  swatchClassForClass,
} from "./weeklyProgressColors";

function segmentGradient(a: FeelingDayClass, b: FeelingDayClass) {
  const color = (c: FeelingDayClass) => `rgb(${pastelSegmentRgb(c)})`;
  return `linear-gradient(90deg, ${color(a)} 0%, ${color(b)} 100%)`;
}

/** Lighter fill + slightly deeper border (pastel family) */
function dayLabelStyle(c: FeelingDayClass): CSSProperties {
  const fill = pastelFillRgb(c);
  const border = pastelBorderRgb(c);
  if (c === "missed") {
    return {
      color: `rgb(${fill})`,
      WebkitTextStroke: `1.2px rgb(${border})`,
      paintOrder: "stroke fill",
    };
  }
  if (c === "no_data") {
    return {
      color: `rgb(${fill})`,
      WebkitTextStroke: `1.15px rgb(${border})`,
      paintOrder: "stroke fill",
    };
  }
  return {
    color: `rgb(${fill})`,
    WebkitTextStroke: `1.2px rgb(${border})`,
    paintOrder: "stroke fill",
  };
}

export function ShopWeeklyProgressBarInner({
  days,
  labelId,
}: {
  days: ShopWeekDay[];
  labelId: string;
}) {
  const legendId = useId();

  return (
    <section className="paper rounded-3xl p-6" aria-labelledby={labelId}>
      <div id={labelId} className="font-paper text-xl">
        Weekly progress
      </div>
      <p className="ink-muted mt-1 text-sm">
        See how the week felt — positive, negative, neutral, missed, or no data —
        with soft blends between days.
      </p>

      <div className="relative mt-5 overflow-hidden rounded-2xl border border-[var(--paper-border)]">
        <div
          className="pointer-events-none absolute inset-0 z-0"
          aria-hidden
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, rgba(0,0,0,0.055) 0 10px, rgba(0,0,0,0.012) 10px 20px)",
          }}
        />
        <div
          className="relative z-[1] grid grid-cols-7 gap-0"
          role="list"
          aria-label="Week feelings, one cell per day"
        >
          {days.map((d, i) => {
            const next = days[Math.min(i + 1, days.length - 1)];
            const bg = segmentGradient(d.feelingClass, next.feelingClass);
            return (
              <div
                key={d.dateKey}
                role="listitem"
                className="relative flex min-h-[5.25rem] flex-col"
              >
                <div
                  className="relative min-h-[5.25rem] flex-1"
                  style={{
                    background:
                      i === days.length - 1
                        ? segmentGradient(d.feelingClass, d.feelingClass)
                        : bg,
                  }}
                />
                {i < days.length - 1 ? (
                  <span
                    className="pointer-events-none absolute right-0 top-0 z-[3] h-full w-[3px] -translate-x-px -skew-x-12 bg-black/18 shadow-[1px_0_0_rgba(255,255,255,0.12)] dark:bg-white/16 dark:shadow-[1px_0_0_rgba(0,0,0,0.28)]"
                    aria-hidden
                  />
                ) : null}
                <div
                  className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center px-0.5"
                  aria-hidden
                >
                  <span
                    className="text-center font-serif text-sm font-bold italic leading-tight sm:text-[0.95rem]"
                    style={{
                      fontFamily: 'Georgia, "Times New Roman", serif',
                      ...dayLabelStyle(d.feelingClass),
                    }}
                  >
                    {d.shortLabel}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        id={legendId}
        className="ink-muted mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs"
      >
        <KeySwatch
          label="Positive"
          className={swatchClassForClass("positive")}
        />
        <KeySwatch
          label="Neutral"
          className={swatchClassForClass("neutral")}
        />
        <KeySwatch
          label="Negative"
          className={swatchClassForClass("negative")}
        />
        <KeySwatch label="Missed" className={swatchClassForClass("missed")} />
        <KeySwatch
          label="No data"
          className={swatchClassForClass("no_data")}
        />
      </div>
    </section>
  );
}

function KeySwatch({ label, className }: { label: string; className: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`inline-block h-3 w-6 rounded-sm ${className}`} />
      {label}
    </span>
  );
}

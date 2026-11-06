import { useEffect, useId, useState, type CSSProperties } from "react";
import { LOCAL_DATA_CHANGED_EVENT } from "../../shared/sync/localDataEvents";
import { getShopWeekDays, type ShopWeekDay } from "./shopWeeklyProgress";
import type { FeelingDayClass } from "../compilation/feelingsSemantics";
import { rgbForFeelingClass } from "./weeklyProgressColors";

function segmentGradient(a: FeelingDayClass, b: FeelingDayClass) {
  const color = (c: FeelingDayClass) => `rgb(${rgbForFeelingClass(c)})`;
  return `linear-gradient(90deg, ${color(a)} 0%, ${color(b)} 100%)`;
}

/** Fill + outline for Georgia day abbrev — outline tracks section hue; missed / no-data per issue */
function dayAbbrStyle(c: FeelingDayClass): CSSProperties {
  const rgb = rgbForFeelingClass(c);
  if (c === "missed") {
    return {
      color: "rgba(248,248,248,0.96)",
      WebkitTextStroke: "1.5px rgba(255,255,255,0.88)",
      paintOrder: "stroke fill",
    };
  }
  if (c === "no_data") {
    return {
      color: "rgba(28,28,32,0.92)",
      WebkitTextStroke: "1.4px rgba(60,60,68,0.9)",
      paintOrder: "stroke fill",
    };
  }
  const [r, g, b] = rgb.split(",").map((x) => Number(x.trim()));
  const darkR = Math.round(r * 0.35);
  const darkG = Math.round(g * 0.35);
  const darkB = Math.round(b * 0.35);
  return {
    color: "rgba(255,255,255,0.94)",
    WebkitTextStroke: `1.35px rgba(${darkR},${darkG},${darkB},0.88)`,
    paintOrder: "stroke fill",
  };
}

export function ShopWeeklyProgressBar() {
  const labelId = useId();
  const [days, setDays] = useState<ShopWeekDay[] | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const next = await getShopWeekDays();
      if (active) setDays(next);
    };
    refresh();
    window.addEventListener(LOCAL_DATA_CHANGED_EVENT, refresh);
    const id = window.setInterval(refresh, 4000);
    return () => {
      active = false;
      window.removeEventListener(LOCAL_DATA_CHANGED_EVENT, refresh);
      window.clearInterval(id);
    };
  }, []);

  if (!days) {
    return (
      <div className="ink-muted text-sm" aria-hidden>
        Loading weekly progress…
      </div>
    );
  }

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
                className="relative flex min-h-[5.25rem] flex-col border-r border-black/12 last:border-r-0"
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
                    className="pointer-events-none absolute right-0 top-0 z-[3] h-full w-[3px] -translate-x-px -skew-x-12 bg-black/22 shadow-[1px_0_0_rgba(255,255,255,0.08)] dark:bg-white/18 dark:shadow-[1px_0_0_rgba(0,0,0,0.35)]"
                    aria-hidden
                  />
                ) : null}
                <div
                  className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center px-1"
                  aria-hidden
                >
                  <span
                    className="text-center font-serif text-base font-bold italic leading-none sm:text-lg"
                    style={{
                      fontFamily: 'Georgia, "Times New Roman", serif',
                      ...dayAbbrStyle(d.feelingClass),
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

      <div className="ink-muted mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs">
        <KeySwatch label="Positive" className="bg-[rgb(42,155,88)]" />
        <KeySwatch label="Neutral" className="bg-[rgb(214,189,64)]" />
        <KeySwatch label="Negative" className="bg-[rgb(198,29,29)]" />
        <KeySwatch label="Missed" className="bg-[rgb(22,22,22)]" />
        <KeySwatch label="No data" className="bg-[rgb(190,190,195)]" />
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

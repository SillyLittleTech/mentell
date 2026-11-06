import { useEffect, useId, useState } from "react";
import { LOCAL_DATA_CHANGED_EVENT } from "../../shared/sync/localDataEvents";
import { getShopWeekDays, type ShopWeekDay } from "./shopWeeklyProgress";
import type { FeelingDayClass } from "../compilation/feelingsSemantics";

function segmentGradient(a: FeelingDayClass, b: FeelingDayClass) {
  const color = (c: FeelingDayClass) => {
    switch (c) {
      case "positive":
        return "rgb(42,155,88)";
      case "neutral":
        return "rgb(214,189,64)";
      case "negative":
        return "rgb(198,29,29)";
      case "missed":
        return "rgb(22,22,22)";
      default:
        return "rgb(190,190,195)";
    }
  };
  return `linear-gradient(90deg, ${color(a)} 0%, ${color(b)} 100%)`;
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
        Gradient bar for this week — each slice blends with the next. Gear motif
        is decorative.
      </p>

      <div
        className="relative mt-5 overflow-hidden rounded-2xl border border-[var(--paper-border)]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, rgba(0,0,0,0.04) 0 10px, rgba(0,0,0,0.01) 10px 20px)",
        }}
      >
        <div
          className="grid grid-cols-7 gap-0"
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
                className="relative min-h-[4.5rem] border-r border-black/10 last:border-r-0"
                style={{
                  background:
                    i === days.length - 1
                      ? segmentGradient(d.feelingClass, d.feelingClass)
                      : bg,
                }}
              >
                <span
                  className="pointer-events-none absolute left-0 top-0 h-full w-px -skew-x-12 bg-black/15"
                  aria-hidden
                />
                <div
                  className="absolute inset-x-1 bottom-2 text-center font-serif text-sm font-bold italic text-black/80 dark:text-white/85"
                  style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                >
                  {d.shortLabel}
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

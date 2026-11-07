import { useEffect, useId, useState } from "react";
import { LOCAL_DATA_CHANGED_EVENT } from "../../shared/sync/localDataEvents";
import { getShopWeekDays, type ShopWeekDay } from "./shopWeeklyProgress";
import { ShopWeeklyProgressBarInner } from "./ShopWeeklyProgressBarInner";

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

  return <ShopWeeklyProgressBarInner days={days} labelId={labelId} />;
}

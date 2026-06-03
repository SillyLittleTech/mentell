import { useEffect, useState } from 'react'
import { LOCAL_DATA_CHANGED_EVENT } from '../../shared/sync/localDataEvents'
import { getWeekTimelineDays, type WeekTimelineDay } from './weekTimeline'

function dotStyle(status: WeekTimelineDay['status']) {
  if (status === 'completed') {
    return {
      borderColor: 'rgba(42,155,88,0.5)',
      background: 'rgba(42,155,88,0.2)',
    }
  }
  if (status === 'missed') {
    return {
      borderColor: 'rgba(198,29,29,0.4)',
      background: 'rgba(198,29,29,0.08)',
      borderStyle: 'dashed' as const,
    }
  }
  return {
    borderColor: 'var(--paper-border)',
    background: 'transparent',
  }
}

export function WeekTimelineCard() {
  const [days, setDays] = useState<WeekTimelineDay[] | null>(null)

  useEffect(() => {
    let active = true
    const refresh = async () => {
      const next = await getWeekTimelineDays()
      if (active) setDays(next)
    }
    refresh()
    const id = window.setInterval(refresh, 3000)
    window.addEventListener(LOCAL_DATA_CHANGED_EVENT, refresh)
    return () => {
      active = false
      window.clearInterval(id)
      window.removeEventListener(LOCAL_DATA_CHANGED_EVENT, refresh)
    }
  }, [])

  return (
    <section className="paper rounded-3xl p-6">
      <div className="font-paper text-xl">This week</div>
      <div className="ink-muted mt-1 text-sm">Mon–Sun log at a glance.</div>

      {days ? (
        <>
          <div className="mt-4 grid grid-cols-7 gap-2">
            {days.map((d) => (
              <div key={d.dateKey} className="flex flex-col items-center gap-1">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2 text-xs font-bold"
                  style={dotStyle(d.status)}
                  title={`${d.dateKey} — ${d.status}`}
                >
                  {d.status === 'completed' ? '+' : d.status === 'missed' ? '·' : ''}
                </div>
                <div className="ink-muted text-[10px] font-medium uppercase">{d.label}</div>
              </div>
            ))}
          </div>
          <div className="ink-muted mt-4 flex flex-wrap gap-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-full border-2 border-[rgba(42,155,88,0.5)] bg-[rgba(42,155,88,0.2)]" />
              Logged
            </span>
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-3 w-3 rounded-full border-2 border-dashed border-[rgba(198,29,29,0.4)]"
              />
              Missed
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-full border-2 border-[var(--paper-border)]" />
              No data yet
            </span>
          </div>
        </>
      ) : (
        <div className="ink-muted mt-4 text-sm">Loading week…</div>
      )}
    </section>
  )
}

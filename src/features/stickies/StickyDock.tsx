import { useEffect, useState } from 'react'
import { LOCAL_DATA_CHANGED_EVENT } from '../../shared/sync/localDataEvents'
import { addSticky, listStickies } from './stickiesService'

const COLORS = ['#fbf4de', '#ffe2e2', '#e6fff0', '#e9f1ff', '#fff0c8']

export function StickyDock() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const refresh = () => void listStickies().then((rows) => setCount(rows.length))
    refresh()
    window.addEventListener(LOCAL_DATA_CHANGED_EVENT, refresh)
    return () => window.removeEventListener(LOCAL_DATA_CHANGED_EVENT, refresh)
  }, [])

  return (
    <section className="paper rounded-3xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-paper text-2xl">Sticky notes</div>
          <div className="ink-muted mt-1 text-sm">
            {count === 0
              ? 'Add a note — it floats on every tab at the same spot.'
              : `${count} note${count === 1 ? '' : 's'} on your desk — visible on all tabs.`}
          </div>
        </div>
        <button
          type="button"
          className="focus-ring rounded-2xl border border-[var(--paper-border)] px-4 py-3 text-xl leading-none"
          aria-label="Add sticky"
          title="Add sticky"
          onClick={async () => {
            const color = COLORS[Math.floor(Math.random() * COLORS.length)]!
            await addSticky({ text: 'New note…', color })
          }}
        >
          📝➕
        </button>
      </div>
    </section>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import type { StickyRow } from '../../db/schema'
import { addSticky, deleteSticky, listStickies, updateSticky } from './stickiesService'

const COLORS = ['#fbf4de', '#ffe2e2', '#e6fff0', '#e9f1ff', '#fff0c8']
const STICKY_WIDTH = 220
const STICKY_HEIGHT = 220
const DRAG_MARGIN = 140
const STICKY_TEXT_COLOR = '#1f1b17'

type DragState = {
  id: string
  offsetX: number
  offsetY: number
}

export function StickyBoard() {
  const [stickies, setStickies] = useState<StickyRow[]>([])
  const [drag, setDrag] = useState<DragState | null>(null)
  const boardRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    listStickies().then(setStickies)
  }, [])

  const maxZ = useMemo(() => Math.max(0, ...stickies.map((s) => s.zIndex)), [stickies])

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!drag) return
      const board = boardRef.current
      if (!board) return
      const rect = board.getBoundingClientRect()
      const x = e.clientX - rect.left - drag.offsetX
      const y = e.clientY - rect.top - drag.offsetY

      setStickies((all) =>
        all.map((s) =>
          s.id === drag.id
            ? {
                ...s,
                x: clamp(x, -DRAG_MARGIN, rect.width - STICKY_WIDTH + DRAG_MARGIN),
                y: clamp(y, -DRAG_MARGIN, rect.height - STICKY_HEIGHT + DRAG_MARGIN),
              }
            : s,
        ),
      )
    }

    const onUp = async () => {
      if (!drag) return
      const s = stickies.find((x) => x.id === drag.id)
      setDrag(null)
      if (!s) return
      await updateSticky(s.id, { x: s.x, y: s.y })
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [drag, stickies])

  const beginDrag = (e: React.PointerEvent<HTMLElement>, sticky: StickyRow) => {
    const card = (e.target as HTMLElement).closest('[data-sticky-card="true"]') as HTMLDivElement | null
    if (!card) return
    const rect = card.getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    const offsetY = e.clientY - rect.top
    const nextZ = maxZ + 1
    setStickies((all) => all.map((x) => (x.id === sticky.id ? { ...x, zIndex: nextZ } : x)))
    setDrag({ id: sticky.id, offsetX, offsetY })
    void updateSticky(sticky.id, { zIndex: nextZ })
  }

  const cycleColor = async (sticky: StickyRow) => {
    const index = COLORS.indexOf(sticky.color)
    const color = COLORS[(index + 1 + COLORS.length) % COLORS.length] ?? COLORS[0]!
    setStickies((all) => all.map((x) => (x.id === sticky.id ? { ...x, color } : x)))
    await updateSticky(sticky.id, { color })
  }

  return (
    <section className="paper rounded-3xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-paper text-2xl">Sticky board</div>
          <div className="ink-muted mt-1 text-sm">Drag them around — they stay put on reload.</div>
        </div>
        <button
          type="button"
          className="focus-ring rounded-2xl border border-[var(--paper-border)] px-4 py-3 text-sm font-medium"
          onClick={async () => {
            const board = boardRef.current
            const rect = board?.getBoundingClientRect()
            const x = rect ? rect.width * 0.55 : 220
            const y = rect ? rect.height * 0.25 : 80
            const color = COLORS[Math.floor(Math.random() * COLORS.length)]!
            const row = await addSticky({ text: 'New note…', x, y, color })
            setStickies((all) => [...all, row])
          }}
        >
          Add sticky
        </button>
      </div>

      <div
        ref={boardRef}
        className="relative mt-5 h-[420px] overflow-visible rounded-3xl border border-[var(--paper-border)]"
      >
        {stickies.map((s) => (
          <div
            key={s.id}
            className="absolute"
            style={{ left: s.x, top: s.y, zIndex: s.zIndex }}
          >
            <div
              className="w-[220px] cursor-grab rounded-3xl border border-black/20 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.18)] active:cursor-grabbing"
              style={{ background: s.color, color: STICKY_TEXT_COLOR, touchAction: 'none' }}
              data-sticky-card="true"
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest('textarea,button')) return
                beginDrag(e, s)
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono text-xs opacity-70">sticky</div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="focus-ring rounded-xl border border-black/20 bg-white/35 px-2 py-1 text-xs"
                    onClick={() => {
                      void cycleColor(s)
                    }}
                  >
                    Color
                  </button>
                  <button
                    type="button"
                    className="focus-ring rounded-xl border border-black/20 bg-white/35 px-2 py-1 text-xs"
                    onClick={async () => {
                      await deleteSticky(s.id)
                      setStickies((all) => all.filter((x) => x.id !== s.id))
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <textarea
                className="mt-3 min-h-[110px] w-full resize-none rounded-2xl bg-white/25 p-1 font-paper text-lg leading-relaxed text-[#1f1b17] outline-none placeholder:text-black/40"
                value={s.text}
                onChange={(e) => {
                  const v = e.target.value
                  setStickies((all) => all.map((x) => (x.id === s.id ? { ...x, text: v } : x)))
                }}
                onBlur={async () => {
                  await updateSticky(s.id, { text: s.text })
                }}
              />

              <button
                type="button"
                className="focus-ring mt-2 w-full cursor-grab rounded-2xl border border-black/20 bg-white/35 px-3 py-2 text-xs font-medium active:cursor-grabbing"
                onPointerDown={(e) => {
                  beginDrag(e, s)
                }}
              >
                Drag
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}


import { useEffect, useMemo, useRef, useState } from 'react'
import type { StickyRow } from '../../db/schema'
import { addSticky, deleteSticky, listStickies, updateSticky } from './stickiesService'

const COLORS = ['#fbf4de', '#ffe2e2', '#e6fff0', '#e9f1ff', '#fff0c8']

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
        all.map((s) => (s.id === drag.id ? { ...s, x: clamp(x, -20, rect.width - 140), y: clamp(y, -20, rect.height - 140) } : s)),
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
        className="relative mt-5 h-[420px] overflow-hidden rounded-3xl border border-[var(--paper-border)]"
      >
        {stickies.map((s) => (
          <div
            key={s.id}
            className="absolute"
            style={{ left: s.x, top: s.y, zIndex: s.zIndex }}
          >
            <div
              className="w-[220px] rounded-3xl border border-black/10 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.18)]"
              style={{ background: s.color }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono text-xs opacity-60">sticky</div>
                <button
                  type="button"
                  className="focus-ring rounded-xl border border-black/10 px-2 py-1 text-xs"
                  onClick={async () => {
                    await deleteSticky(s.id)
                    setStickies((all) => all.filter((x) => x.id !== s.id))
                  }}
                >
                  X
                </button>
              </div>

              <textarea
                className="mt-3 min-h-[110px] w-full resize-none rounded-2xl bg-transparent font-paper text-lg leading-relaxed outline-none"
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
                className="focus-ring mt-2 w-full cursor-grab rounded-2xl border border-black/10 px-3 py-2 text-xs font-medium active:cursor-grabbing"
                onPointerDown={async (e) => {
                  const el = e.currentTarget.closest('div') as HTMLDivElement | null
                  if (!el) return
                  const rect = el.getBoundingClientRect()
                  const offsetX = e.clientX - rect.left
                  const offsetY = e.clientY - rect.top

                  const nextZ = maxZ + 1
                  setStickies((all) => all.map((x) => (x.id === s.id ? { ...x, zIndex: nextZ } : x)))
                  await updateSticky(s.id, { zIndex: nextZ })
                  setDrag({ id: s.id, offsetX, offsetY })
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


import type { StickyRow } from '../../db/schema'

/** Approximate Y offset from old Notes board coords to viewport (header + nav + padding). */
export const LEGACY_BOARD_OFFSET_Y = 320

const STICKY_WIDTH = 220
const STICKY_MIN_MARGIN = 8

export function stickyDisplayPosition(s: StickyRow): { x: number; y: number } {
  if (s.coordSpace === 'board') {
    return { x: s.x, y: s.y + LEGACY_BOARD_OFFSET_Y }
  }
  return { x: s.x, y: s.y }
}

export function defaultStickyPosition() {
  const w = typeof window !== 'undefined' ? window.innerWidth : 800
  const h = typeof window !== 'undefined' ? window.innerHeight : 600
  return {
    x: Math.max(STICKY_MIN_MARGIN, w * 0.55 - STICKY_WIDTH / 2),
    y: Math.max(STICKY_MIN_MARGIN, h * 0.3),
  }
}

export function clampStickyPosition(x: number, y: number) {
  const w = typeof window !== 'undefined' ? window.innerWidth : 800
  const h = typeof window !== 'undefined' ? window.innerHeight : 600
  return {
    x: Math.min(Math.max(STICKY_MIN_MARGIN, x), w - STICKY_WIDTH - STICKY_MIN_MARGIN),
    y: Math.min(Math.max(STICKY_MIN_MARGIN, y), h - 180 - STICKY_MIN_MARGIN),
  }
}

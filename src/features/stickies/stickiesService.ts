import { db, type StickyRow } from '../../db/schema'
import { makeId } from '../../shared/id'

export async function listStickies() {
  return await db.stickies.orderBy('zIndex').toArray()
}

export async function addSticky(input: { text: string; x: number; y: number; color: string }) {
  const existing = await db.stickies.orderBy('zIndex').last()
  const nextZ = (existing?.zIndex ?? 0) + 1
  const row: StickyRow = {
    id: makeId('sticky'),
    createdAt: Date.now(),
    text: input.text,
    x: input.x,
    y: input.y,
    color: input.color,
    zIndex: nextZ,
  }
  await db.stickies.put(row)
  return row
}

export async function updateSticky(id: string, patch: Partial<Pick<StickyRow, 'text' | 'x' | 'y' | 'zIndex' | 'color'>>) {
  await db.stickies.update(id, patch)
}

export async function deleteSticky(id: string) {
  await db.stickies.delete(id)
}


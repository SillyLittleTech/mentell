import { db, type StickyRow } from '../../db/schema'
import { makeId } from '../../shared/id'
import { notifyLocalDataChanged } from '../../shared/sync/localDataEvents'

export async function listStickies() {
  return await db.stickies.orderBy('zIndex').toArray()
}

export async function addSticky(input: { text: string; x: number; y: number; color: string }) {
  const existing = await db.stickies.orderBy('zIndex').last()
  const nextZ = (existing?.zIndex ?? 0) + 1
  const now = Date.now()
  const row: StickyRow = {
    id: makeId('sticky'),
    createdAt: now,
    updatedAt: now,
    text: input.text,
    x: input.x,
    y: input.y,
    color: input.color,
    zIndex: nextZ,
  }
  await db.stickies.put(row)
  notifyLocalDataChanged()
  return row
}

export async function updateSticky(id: string, patch: Partial<Pick<StickyRow, 'text' | 'x' | 'y' | 'zIndex' | 'color'>>) {
  await db.stickies.update(id, { ...patch, updatedAt: Date.now() })
  notifyLocalDataChanged()
}

export async function deleteSticky(id: string) {
  await db.stickies.delete(id)
  notifyLocalDataChanged()
}


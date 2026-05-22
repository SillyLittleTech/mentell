import { getDb, type StickyRow } from '../../db/schema'
import { makeId } from '../../shared/id'
import { notifyLocalDataChanged } from '../../shared/sync/localDataEvents'
import { defaultStickyPosition } from './stickyCoords'

export async function listStickies() {
  return await getDb().stickies.orderBy('zIndex').toArray()
}

export async function addSticky(input: {
  text: string
  x?: number
  y?: number
  color: string
}) {
  const existing = await getDb().stickies.orderBy('zIndex').last()
  const nextZ = (existing?.zIndex ?? 0) + 1
  const now = Date.now()
  const pos = defaultStickyPosition()
  const row: StickyRow = {
    id: makeId('sticky'),
    createdAt: now,
    updatedAt: now,
    text: input.text,
    x: input.x ?? pos.x,
    y: input.y ?? pos.y,
    color: input.color,
    zIndex: nextZ,
    coordSpace: 'viewport',
  }
  await getDb().stickies.put(row)
  notifyLocalDataChanged()
  return row
}

export async function updateSticky(
  id: string,
  patch: Partial<Pick<StickyRow, 'text' | 'x' | 'y' | 'zIndex' | 'color' | 'coordSpace'>>,
) {
  await getDb().stickies.update(id, { ...patch, updatedAt: Date.now() })
  notifyLocalDataChanged()
}

export async function deleteSticky(id: string) {
  await getDb().stickies.delete(id)
  notifyLocalDataChanged()
}

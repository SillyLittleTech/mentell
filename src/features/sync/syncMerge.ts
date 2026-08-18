import { getDb } from '../../db/schema'
import type { OfflineSyncData } from './cryptSync'
import { loadAppSettings, saveAppSettings } from '../../shared/settings/appSettings'
import { notifyLocalDataChanged } from '../../shared/sync/localDataEvents'
import type { Table } from 'dexie'

export async function mergeOfflineSyncData(incoming: OfflineSyncData): Promise<void> {
  const db = getDb()

  await db.transaction('rw', db.entries, db.notes, db.packages, db.stickies, async () => {
    async function mergeCollection<T extends { id: string; updatedAt?: number; createdAt?: number }>(
      table: Table<T, string>,
      incomingRows: T[],
    ) {
      if (!incomingRows || incomingRows.length === 0) return

      const incomingIds = incomingRows.map((r) => r.id)
      const localRows = await table.where('id').anyOf(incomingIds).toArray()
      const localMap = new Map(localRows.map((r) => [r.id, r]))

      const toPut: T[] = []
      for (const inc of incomingRows) {
        const loc = localMap.get(inc.id)
        if (!loc) {
          toPut.push(inc)
          continue
        }

        const incTime = inc.updatedAt ?? inc.createdAt ?? 0
        const locTime = loc.updatedAt ?? loc.createdAt ?? 0

        if (incTime > locTime) {
          toPut.push(inc)
        }
      }

      if (toPut.length > 0) {
        await table.bulkPut(toPut)
      }
    }

    await mergeCollection(db.entries, incoming.entries)
    await mergeCollection(db.notes, incoming.notes)
    await mergeCollection(db.packages, incoming.packages)
    await mergeCollection(db.stickies, incoming.stickies)
  })

  if (incoming.settings) {
    const currentSettings = loadAppSettings()
    saveAppSettings({ ...currentSettings, ...incoming.settings })
  } else {
    notifyLocalDataChanged()
  }
}

/** Wipe local journal collections and install the snapshot as this device's copy. */
export async function replaceOfflineSyncData(incoming: OfflineSyncData): Promise<void> {
  const db = getDb()

  await db.transaction('rw', db.entries, db.notes, db.packages, db.stickies, async () => {
    await db.entries.clear()
    await db.notes.clear()
    await db.packages.clear()
    await db.stickies.clear()
    if (incoming.entries.length) await db.entries.bulkPut(incoming.entries)
    if (incoming.notes.length) await db.notes.bulkPut(incoming.notes)
    if (incoming.packages.length) await db.packages.bulkPut(incoming.packages)
    if (incoming.stickies.length) await db.stickies.bulkPut(incoming.stickies)
  })

  if (incoming.settings) {
    saveAppSettings(incoming.settings)
  } else {
    notifyLocalDataChanged()
  }
}

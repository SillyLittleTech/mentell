import { getDb } from '../../db/schema'
import type { OfflineSyncData } from './cryptSync'
import { loadAppSettings, saveAppSettings } from '../../shared/settings/appSettings'
import type { Table } from 'dexie'

export async function mergeOfflineSyncData(incoming: OfflineSyncData): Promise<void> {
  const db = getDb()

  await db.transaction('rw', db.entries, db.notes, db.packages, db.stickies, async () => {
    // Helper function for merging collections using last-write-wins by updatedAt
    async function mergeCollection<T extends { id: string; updatedAt?: number; createdAt?: number }>(
      table: Table<T, string>,
      incomingRows: T[]
    ) {
      if (!incomingRows || incomingRows.length === 0) return

      const incomingIds = incomingRows.map(r => r.id)
      const localRows = await table.where('id').anyOf(incomingIds).toArray()
      const localMap = new Map(localRows.map(r => [r.id, r]))

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
    const mergedSettings = { ...currentSettings, ...incoming.settings }
    saveAppSettings(mergedSettings)
  }
}

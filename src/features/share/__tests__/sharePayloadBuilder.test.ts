import { describe, it, expect, beforeEach } from 'vitest'
import { getDb, type EntryRow } from '../../../db/schema'
import { buildSharePayload } from '../sharePayloadBuilder'
import { SHARE_PRESETS } from '../shareTypes'

describe('sharePayloadBuilder', () => {
  beforeEach(async () => {
    // Clear db for tests
    await getDb().entries.clear()
  })

  it('correctly queries normal and bulk entries within the date cutoff', async () => {
    const db = getDb()
    
    await db.entries.bulkPut([
      { id: '1', dateKey: '2000-10-01', createdAt: 1, sentiment: '+', warningLevel: 'none' } as EntryRow,
      { id: '2', dateKey: '2099-11-10', createdAt: 2, sentiment: '-', warningLevel: 'warn' } as EntryRow,
      { id: '3', dateKey: '2099-11-15', createdAt: 3, sentiment: '=', warningLevel: 'none' } as EntryRow,
      { id: '4', dateKey: '~2000-10-01', createdAt: 4, sentiment: '+', warningLevel: 'none' } as EntryRow,
      { id: '5', dateKey: '~2099-11-12', createdAt: 5, sentiment: '+', warningLevel: 'none' } as EntryRow,
    ])

    // since we do not fake timers, maxDays 14 cutoff will definitely include 2099.
    const payload = await buildSharePayload(SHARE_PRESETS.family)
    
    expect(payload.entryCount).toBe(3)
    expect(payload.entries.length).toBe(3)
    const returnedIds = payload.entries.map(e => e.id).sort()
    expect(returnedIds).toEqual(['2', '3', '5'])
    expect(payload.warnings).toBe(1)
  })
})

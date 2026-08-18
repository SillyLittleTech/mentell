import { describe, it, expect, beforeEach } from 'vitest'
import { mergeOfflineSyncData } from '../syncMerge'
import { getDb } from '../../../db/schema'
import type { OfflineSyncData } from '../cryptSync'
import type { AppSettings } from '../../../shared/settings/appSettings'
import 'fake-indexeddb/auto'

describe('Offline Sync Merge', () => {
  beforeEach(async () => {
    const db = getDb()
    await db.entries.clear()
    await db.notes.clear()
    await db.packages.clear()
    await db.stickies.clear()
  })

  it('merges last-write-wins', async () => {
    const db = getDb()

    // Insert local entry
    await db.entries.put({
      id: 'entry1',
      dateKey: '2023-01-01',
      createdAt: 1000,
      updatedAt: 1000,
      sentiment: '+',
      emotion: 'happy',
      emotionNote: '',
      situation: 'Local',
      details: '',
      behavioursNoted: '',
      reoccurringTheme: '',
      flaggedTerms: [],
      warningLevel: 'none',
      riskScore: 0,
      interventionScore: 0,
      riskLevel: 'none',
      scoreDelta: 0,
      streakAtSubmit: 1
    })

    const incoming: OfflineSyncData = {
      entries: [
        {
          id: 'entry1',
          dateKey: '2023-01-01',
          createdAt: 1000,
          updatedAt: 2000, // newer!
          sentiment: '-',
          emotion: 'sad',
          emotionNote: '',
          situation: 'Incoming',
          details: '',
          behavioursNoted: '',
          reoccurringTheme: '',
          flaggedTerms: [],
          warningLevel: 'none',
          riskScore: 0,
          interventionScore: 0,
          riskLevel: 'none',
          scoreDelta: 0,
          streakAtSubmit: 1
        },
        {
          id: 'entry2', // new entry
          dateKey: '2023-01-02',
          createdAt: 3000,
          updatedAt: 3000,
          sentiment: '+',
          emotion: 'happy',
          emotionNote: '',
          situation: 'New Incoming',
          details: '',
          behavioursNoted: '',
          reoccurringTheme: '',
          flaggedTerms: [],
          warningLevel: 'none',
          riskScore: 0,
          interventionScore: 0,
          riskLevel: 'none',
          scoreDelta: 0,
          streakAtSubmit: 1
        }
      ],
      notes: [],
      packages: [],
      stickies: [],
      settings: {} as AppSettings
    }

    await mergeOfflineSyncData(incoming)

    const entries = await db.entries.toArray()
    expect(entries.length).toBe(2)

    const entry1 = await db.entries.get('entry1')
    expect(entry1?.situation).toBe('Incoming') // should be updated

    const entry2 = await db.entries.get('entry2')
    expect(entry2?.situation).toBe('New Incoming')
  })
})

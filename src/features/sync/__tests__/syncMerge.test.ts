import { describe, it, expect, beforeEach } from 'vitest'
import { mergeOfflineSyncData, replaceOfflineSyncData } from '../syncMerge'
import { getDb } from '../../../db/schema'
import type { OfflineSyncData } from '../cryptSync'
import type { AppSettings } from '../../../shared/settings/appSettings'
import 'fake-indexeddb/auto'

describe('Offline Sync Merge', () => {
  beforeEach(async () => {
    const mem = new Map<string, string>()
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => mem.get(key) ?? null,
        setItem: (key: string, value: string) => {
          mem.set(key, String(value))
        },
        removeItem: (key: string) => {
          mem.delete(key)
        },
        clear: () => mem.clear(),
        key: (index: number) => [...mem.keys()][index] ?? null,
        get length() {
          return mem.size
        },
      },
    })
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

  it('replace drops local-only rows', async () => {
    const db = getDb()

    await db.entries.bulkPut([
      {
        id: 'keep',
        dateKey: '2023-01-01',
        createdAt: 1000,
        updatedAt: 1000,
        sentiment: '+',
        emotion: 'happy',
        emotionNote: '',
        situation: 'Local keep',
        details: '',
        behavioursNoted: '',
        reoccurringTheme: '',
        flaggedTerms: [],
        warningLevel: 'none',
        riskScore: 0,
        interventionScore: 0,
        riskLevel: 'none',
        scoreDelta: 0,
        streakAtSubmit: 1,
      },
      {
        id: 'drop',
        dateKey: '2023-01-02',
        createdAt: 2000,
        updatedAt: 2000,
        sentiment: '-',
        emotion: 'sad',
        emotionNote: '',
        situation: 'Local only',
        details: '',
        behavioursNoted: '',
        reoccurringTheme: '',
        flaggedTerms: [],
        warningLevel: 'none',
        riskScore: 0,
        interventionScore: 0,
        riskLevel: 'none',
        scoreDelta: 0,
        streakAtSubmit: 1,
      },
    ])

    const incoming: OfflineSyncData = {
      entries: [
        {
          id: 'keep',
          dateKey: '2023-01-01',
          createdAt: 1000,
          updatedAt: 1500,
          sentiment: '+',
          emotion: 'calm',
          emotionNote: '',
          situation: 'Master',
          details: '',
          behavioursNoted: '',
          reoccurringTheme: '',
          flaggedTerms: [],
          warningLevel: 'none',
          riskScore: 0,
          interventionScore: 0,
          riskLevel: 'none',
          scoreDelta: 0,
          streakAtSubmit: 1,
        },
      ],
      notes: [],
      packages: [],
      stickies: [],
      settings: {} as AppSettings,
    }

    await replaceOfflineSyncData(incoming)

    const entries = await db.entries.toArray()
    expect(entries.map((e) => e.id).sort()).toEqual(['keep'])
    expect(entries[0]?.situation).toBe('Master')
  })
})

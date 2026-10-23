import { describe, it, expect } from 'vitest'
import { getRecoverableScoreOptions, type CloudScoreMeta } from './scoreRecovery'

describe('getRecoverableScoreOptions', () => {
  it('handles null meta', () => {
    const result = getRecoverableScoreOptions(null, 100)
    expect(result).toEqual({
      cloudTotal: 0,
      peakTotal: 0,
      snapshots: []
    })
  })

  it('handles empty meta', () => {
    const result = getRecoverableScoreOptions({} as CloudScoreMeta, 100)
    expect(result).toEqual({
      cloudTotal: 0,
      peakTotal: 0,
      snapshots: []
    })
  })

  it('truncates cloudTotal and peakTotal correctly', () => {
    const meta: CloudScoreMeta = {
      total: 105.7,
      peakTotal: 200.2
    }
    const result = getRecoverableScoreOptions(meta, 50)
    expect(result.cloudTotal).toBe(105)
    expect(result.peakTotal).toBe(200)
  })

  it('sets peakTotal to cloudTotal if cloudTotal is greater', () => {
    const meta: CloudScoreMeta = {
      total: 300,
      peakTotal: 200
    }
    const result = getRecoverableScoreOptions(meta, 50)
    expect(result.peakTotal).toBe(300)
  })

  it('handles non-number total and peakTotal gracefully', () => {
    const meta = {
      total: '100',
      peakTotal: '200'
    } as unknown as CloudScoreMeta
    const result = getRecoverableScoreOptions(meta, 50)
    expect(result.cloudTotal).toBe(0)
    expect(result.peakTotal).toBe(0)
  })

  it('filters out snapshots with total <= localTotal', () => {
    const meta: CloudScoreMeta = {
      snapshots: [
        { total: 50, streak: 1, savedAt: 1 },
        { total: 100, streak: 1, savedAt: 2 },
        { total: 150, streak: 1, savedAt: 3 }
      ]
    }
    const result = getRecoverableScoreOptions(meta, 100)
    expect(result.snapshots.length).toBe(1)
    expect(result.snapshots[0].total).toBe(150)
  })

  it('filters out snapshots with non-number total', () => {
    const meta: CloudScoreMeta = {
      snapshots: [
        { total: '150' as unknown as number, streak: 1, savedAt: 1 },
        { total: 200, streak: 1, savedAt: 2 }
      ]
    }
    const result = getRecoverableScoreOptions(meta, 100)
    expect(result.snapshots.length).toBe(1)
    expect(result.snapshots[0].total).toBe(200)
  })

  it('maps correct original index into snapshots and sorts them descending by total', () => {
    const meta: CloudScoreMeta = {
      snapshots: [
        { total: 150, streak: 1, savedAt: 1 }, // index 0
        { total: 300, streak: 1, savedAt: 2 }, // index 1
        { total: 100, streak: 1, savedAt: 3 }, // index 2 (filtered out)
        { total: 200, streak: 1, savedAt: 4 }  // index 3
      ]
    }
    const result = getRecoverableScoreOptions(meta, 120)

    expect(result.snapshots.length).toBe(3)

    // Should be sorted by total descending
    expect(result.snapshots[0]).toEqual(expect.objectContaining({ total: 300, index: 1 }))
    expect(result.snapshots[1]).toEqual(expect.objectContaining({ total: 200, index: 3 }))
    expect(result.snapshots[2]).toEqual(expect.objectContaining({ total: 150, index: 0 }))
  })
})

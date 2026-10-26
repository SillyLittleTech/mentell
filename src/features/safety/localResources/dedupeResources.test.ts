import { describe, expect, it } from 'vitest'
import { dedupePooledAgainstExisting, formatPooledSourceLabel } from './dedupeResources'
import type { LocalResource } from './types'

const existing: LocalResource[] = [
  {
    id: 'gh-1',
    kind: 'helpline',
    name: '988 Suicide & Crisis Lifeline',
    phone: '988',
    sourceLabel: 'US 988 Lifeline',
  },
  {
    id: 'gh-2',
    kind: 'helpline',
    name: 'CONTACT Altoona Helpline',
    phone: '814-946-9050',
    sourceLabel: 'Global Helplines',
  },
]

describe('formatPooledSourceLabel', () => {
  it('appends pooled scrape suffix', () => {
    expect(formatPooledSourceLabel('UPMC Altoona')).toBe(
      'UPMC Altoona (Pooled Scrape, check important details)',
    )
  })
})

describe('dedupePooledAgainstExisting', () => {
  it('drops duplicate phones and similar names', () => {
    const pooled: LocalResource[] = [
      {
        id: 'p1',
        kind: 'pooled',
        name: '988 Lifeline',
        phone: '988',
        sourceLabel: 'x',
      },
      {
        id: 'p2',
        kind: 'pooled',
        name: 'CONTACT Altoona',
        phone: '814-946-9050',
        sourceLabel: 'x',
      },
      {
        id: 'p3',
        kind: 'pooled',
        name: 'Blair County Mobile Crisis',
        phone: '814-555-0100',
        sourceLabel: 'x',
      },
    ]
    const kept = dedupePooledAgainstExisting(pooled, existing)
    expect(kept).toHaveLength(1)
    expect(kept[0]?.name).toBe('Blair County Mobile Crisis')
  })
})

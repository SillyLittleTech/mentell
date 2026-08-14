import { describe, expect, it } from 'vitest'
import {
  WEEK_MS,
  eligibleGreetings,
  formatGreetingSegments,
  pickRandomItem,
  resolveGreetingAddresseeKind,
  timeOfDayAt,
  type GreetingTemplate,
} from './greetingAddress'

const GREETINGS: GreetingTemplate[] = [
  { id: 'morning', text: 'Good morning {name}', timeOfDay: 'morning' },
  { id: 'afternoon', text: 'Good afternoon {name}', timeOfDay: 'afternoon' },
  { id: 'evening', text: 'Good evening {name}', timeOfDay: 'evening' },
  { id: 'hello', text: 'Hello {name}' },
]

describe('resolveGreetingAddresseeKind', () => {
  const now = 1_700_000_000_000

  it('uses the set display name when present', () => {
    expect(
      resolveGreetingAddresseeKind({
        displayName: 'Kiya',
        isLoggedIn: false,
        oldestContentAt: null,
        now,
      }),
    ).toBe('name')
  })

  it('uses anon nicknames when there is no previous data', () => {
    expect(
      resolveGreetingAddresseeKind({
        displayName: '',
        isLoggedIn: false,
        oldestContentAt: null,
        now,
      }),
    ).toBe('anon')
  })

  it('uses anon nicknames when data is less than a week old', () => {
    expect(
      resolveGreetingAddresseeKind({
        displayName: '  ',
        isLoggedIn: true,
        oldestContentAt: now - WEEK_MS + 1,
        now,
      }),
    ).toBe('anon')
  })

  it('uses nicknames when data is at least a week old', () => {
    expect(
      resolveGreetingAddresseeKind({
        displayName: '',
        isLoggedIn: false,
        oldestContentAt: now - WEEK_MS,
        now,
      }),
    ).toBe('nickname')
  })
})

describe('timeOfDayAt / eligibleGreetings', () => {
  it('classifies morning, afternoon, and evening hours', () => {
    expect(timeOfDayAt(new Date(2026, 7, 14, 5, 0, 0))).toBe('morning')
    expect(timeOfDayAt(new Date(2026, 7, 14, 13, 0, 0))).toBe('afternoon')
    expect(timeOfDayAt(new Date(2026, 7, 14, 20, 0, 0))).toBe('evening')
    expect(timeOfDayAt(new Date(2026, 7, 14, 2, 0, 0))).toBe('evening')
  })

  it('keeps untimed greetings plus the matching time of day', () => {
    const ids = eligibleGreetings(GREETINGS, 'morning').map((row) => row.id)
    expect(ids).toEqual(['morning', 'hello'])
  })
})

describe('formatGreetingSegments', () => {
  it('splits the name placeholder out of the template', () => {
    expect(formatGreetingSegments('Good morning {name}', 'Kiya')).toEqual([
      { kind: 'text', value: 'Good morning ' },
      { kind: 'name', value: 'Kiya' },
    ])
  })

  it('keeps punctuation around the name', () => {
    expect(formatGreetingSegments("What's new, {name}", 'cupcake')).toEqual([
      { kind: 'text', value: "What's new, " },
      { kind: 'name', value: 'cupcake' },
    ])
  })
})

describe('pickRandomItem', () => {
  it('picks a deterministic index from the random source', () => {
    expect(pickRandomItem(['a', 'b', 'c'], () => 0)).toBe('a')
    expect(pickRandomItem(['a', 'b', 'c'], () => 0.99)).toBe('c')
  })
})

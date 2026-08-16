import { afterEach, describe, expect, it } from 'vitest'
import { greetingsCatalog } from './greetingsCatalog'
import { resetHomeGreetingSessionForTests, resolveHomeGreeting } from './resolveHomeGreeting'
import { WEEK_MS } from './greetingAddress'

describe('greetingsCatalog', () => {
  it('loads greetings with a name placeholder', () => {
    expect(greetingsCatalog.greetings.length).toBeGreaterThan(5)
    for (const greeting of greetingsCatalog.greetings) {
      expect(greeting.text).toContain('{name}')
    }
    expect(greetingsCatalog.nicknames).toEqual(
      expect.arrayContaining(['cutie pie', 'applejack', 'cupcake']),
    )
    expect(greetingsCatalog.anonNicknames).toEqual(
      expect.arrayContaining(['Stranger', 'Mystery', 'Wind']),
    )
  })
})

describe('resolveHomeGreeting', () => {
  afterEach(() => {
    resetHomeGreetingSessionForTests()
  })

  it('uses the global name when set', () => {
    const resolved = resolveHomeGreeting({
      displayName: 'Kiya',
      isLoggedIn: false,
      oldestContentAt: null,
      now: new Date(2026, 7, 14, 9, 0, 0),
    })
    expect(resolved.kind).toBe('name')
    expect(resolved.name).toBe('Kiya')
    expect(resolved.phrase).toContain('Kiya')
    expect(resolved.phrase).not.toContain('{name}')
  })

  it('uses an anon nickname for brand-new journals', () => {
    const resolved = resolveHomeGreeting({
      displayName: '',
      isLoggedIn: false,
      oldestContentAt: null,
      now: new Date(2026, 7, 14, 9, 0, 0),
    })
    expect(resolved.kind).toBe('anon')
    expect(greetingsCatalog.anonNicknames).toContain(resolved.name)
  })

  it('uses a friendly nickname once data is a week old', () => {
    const now = new Date(2026, 7, 14, 9, 0, 0)
    const resolved = resolveHomeGreeting({
      displayName: '',
      isLoggedIn: false,
      oldestContentAt: now.getTime() - WEEK_MS,
      now,
    })
    expect(resolved.kind).toBe('nickname')
    expect(greetingsCatalog.nicknames).toContain(resolved.name)
  })

  it('keeps the same greeting for the rest of the session day', () => {
    const now = new Date(2026, 7, 14, 9, 0, 0)
    const first = resolveHomeGreeting({
      displayName: 'Kiya',
      isLoggedIn: false,
      oldestContentAt: null,
      now,
    })
    const second = resolveHomeGreeting({
      displayName: 'Kiya',
      isLoggedIn: false,
      oldestContentAt: null,
      now,
    })
    expect(second.template.id).toBe(first.template.id)
    expect(second.phrase).toBe(first.phrase)
  })

  it('updates the phrase immediately when the global name changes', () => {
    const now = new Date(2026, 7, 14, 9, 0, 0)
    const before = resolveHomeGreeting({
      displayName: '',
      isLoggedIn: false,
      oldestContentAt: null,
      now,
    })
    const after = resolveHomeGreeting({
      displayName: 'Kiya',
      isLoggedIn: false,
      oldestContentAt: null,
      now,
    })
    expect(before.kind).toBe('anon')
    expect(after.kind).toBe('name')
    expect(after.template.id).toBe(before.template.id)
    expect(after.name).toBe('Kiya')
    expect(after.phrase).toBe(after.template.text.replaceAll('{name}', 'Kiya'))
    expect(after.phrase).not.toBe(before.phrase)
  })
})

import { describe, it, expect } from 'vitest'
import { makeId } from './id'

describe('makeId', () => {
  it('generates an ID with the given prefix', () => {
    const id = makeId('test')
    expect(id).toMatch(/^test_/)
  })

  it('generates unique IDs', () => {
    const id1 = makeId('test')
    const id2 = makeId('test')
    expect(id1).not.toBe(id2)
  })

  it('contains three parts separated by underscores', () => {
    const id = makeId('prefix')
    const parts = id.split('_')
    expect(parts.length).toBe(3)
    expect(parts[0]).toBe('prefix')
    expect(parts[1].length).toBeGreaterThan(0)
    expect(parts[2].length).toBeGreaterThan(0)
  })
})

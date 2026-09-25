import { describe, expect, it } from 'vitest'
import { bumpNavReplayTokens } from './navReplay'

describe('bumpNavReplayTokens', () => {
  it('increments the token for the clicked route', () => {
    expect(bumpNavReplayTokens({}, '/notes')).toEqual({ '/notes': 1 })
    expect(bumpNavReplayTokens({ '/notes': 1 }, '/notes')).toEqual({ '/notes': 2 })
  })

  it('preserves tokens for other routes', () => {
    expect(bumpNavReplayTokens({ '/week': 3 }, '/shop')).toEqual({ '/week': 3, '/shop': 1 })
  })
})

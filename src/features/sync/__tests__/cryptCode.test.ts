import { describe, expect, it } from 'vitest'
import {
  canEncodeQrValue,
  cryptCodeFromLocation,
  encodeCryptCode,
  parseCryptCode,
} from '../cryptCode'

describe('crypt code encoding', () => {
  it('round-trips compact payload and key', () => {
    const encoded = encodeCryptCode('abcDEF-_123', 'keyKEY-_456')
    expect(encoded).toBe('payload=abcDEF-_123&key=keyKEY-_456')
    expect(parseCryptCode(encoded)).toEqual({
      payloadBase64Url: 'abcDEF-_123',
      keyBase64Url: 'keyKEY-_456',
    })
  })

  it('parses hash fragments, query strings, and full URLs', () => {
    const expected = {
      payloadBase64Url: 'pay',
      keyBase64Url: 'secret',
    }
    expect(parseCryptCode('#payload=pay&key=secret')).toEqual(expected)
    expect(parseCryptCode('?payload=pay&key=secret')).toEqual(expected)
    expect(
      parseCryptCode('https://projects.slt.ong/mentell/share/cryptl#payload=pay&key=secret'),
    ).toEqual(expected)
    expect(
      parseCryptCode('https://example.test/index.html#/share/cryptl?payload=pay&key=secret'),
    ).toEqual(expected)
  })

  it('rejects missing fields', () => {
    expect(() => parseCryptCode('payload=only')).toThrow('Invalid crypto code format.')
    expect(() => parseCryptCode('')).toThrow('Invalid crypto code format.')
  })

  it('reads a code from window-like location fields', () => {
    expect(
      cryptCodeFromLocation({
        href: 'https://example.test/mentell/share/cryptl#payload=p1&key=k1',
        search: '',
        hash: '#payload=p1&key=k1',
      }),
    ).toBe('payload=p1&key=k1')
  })

  it('caps QR payload size', () => {
    expect(canEncodeQrValue('short')).toBe(true)
    expect(canEncodeQrValue('x'.repeat(1801))).toBe(false)
    expect(canEncodeQrValue('')).toBe(false)
  })
})

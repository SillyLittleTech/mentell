import { vi } from 'vitest'
import 'fake-indexeddb/auto'
import { webcrypto } from 'node:crypto'

Object.defineProperty(window, 'crypto', {
  value: {
    subtle: webcrypto.subtle,
    getRandomValues: (arr: Uint8Array) => webcrypto.getRandomValues(arr),
  },
  configurable: true
})

Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    }),
  },
  configurable: true,
})

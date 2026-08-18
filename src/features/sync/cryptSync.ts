import type { ShareDashboardPayload } from '../share/shareTypes'
import type { EntryRow, NoteRow, PackageRow, StickyRow } from '../../db/schema'
import type { AppSettings } from '../../shared/settings/appSettings'

export type OfflineSyncPayload = {
  version: 1
  createdAt: number
  expiresAt: number | null
  sender: {
    displayName: string | null
    identifier: string | null
  }
  data: OfflineSyncData | ShareDashboardPayload
}

export type OfflineSyncData = {
  entries: EntryRow[]
  notes: NoteRow[]
  packages: PackageRow[]
  stickies: StickyRow[]
  settings: AppSettings
}

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export function base64UrlToBytes(base64: string): Uint8Array {
  // Pad with '=' so length is a multiple of 4
  let b64 = base64.replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4) {
    b64 += '='
  }
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function compressStream(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('gzip')
  const writer = cs.writable.getWriter()
  void writer.write(data.slice()).then(() => writer.close())
  const res = new Response(cs.readable)
  return new Uint8Array(await res.arrayBuffer())
}

async function decompressStream(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('gzip')
  const writer = ds.writable.getWriter()
  void writer.write(data.slice()).then(() => writer.close())
  const res = new Response(ds.readable)
  return new Uint8Array(await res.arrayBuffer())
}

export async function createOfflineSyncPayload(
  payload: OfflineSyncPayload
): Promise<{ payloadBase64Url: string; keyBase64Url: string }> {
  const jsonStr = JSON.stringify(payload)
  const jsonBytes = textEncoder.encode(jsonStr)

  const compressed = await compressStream(jsonBytes)

  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
  const rawKey = await crypto.subtle.exportKey('raw', key)
  const keyBase64Url = bytesToBase64Url(new Uint8Array(rawKey))

  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    compressed.slice()
  )
  const ciphertext = new Uint8Array(ciphertextBuf)

  const packaged = new Uint8Array(1 + 12 + ciphertext.length)
  packaged[0] = 1 // version byte
  packaged.set(iv, 1)
  packaged.set(ciphertext, 13)

  return {
    payloadBase64Url: bytesToBase64Url(packaged),
    keyBase64Url,
  }
}

export async function decryptOfflineSyncPayload(
  payloadBase64Url: string,
  keyBase64Url: string
): Promise<OfflineSyncPayload> {
  const packaged = base64UrlToBytes(payloadBase64Url)
  if (packaged[0] !== 1) {
    throw new Error('Unsupported offline sync payload version')
  }

  const iv = packaged.slice(1, 13)
  const ciphertext = packaged.slice(13)

  const rawKey = base64UrlToBytes(keyBase64Url)
  const key = await crypto.subtle.importKey(
    'raw',
    rawKey.slice(),
    'AES-GCM',
    false,
    ['encrypt', 'decrypt']
  )

  const compressedBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.slice() },
    key,
    ciphertext.slice()
  )
  const compressed = new Uint8Array(compressedBuf)

  const decompressed = await decompressStream(compressed)

  const jsonStr = textDecoder.decode(decompressed)
  const payload = JSON.parse(jsonStr) as OfflineSyncPayload

  if (payload.expiresAt && Date.now() > payload.expiresAt) {
    throw new Error('Offline sync payload has expired')
  }

  return payload
}

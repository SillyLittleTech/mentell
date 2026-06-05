import type { ShareDashboardPayload, SharePayloadEnvelope } from './shareTypes'

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

const PBKDF2_ITERATIONS = 150_000

function toArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

function base64ToBytes(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function deriveWrappingKey(passphrase: string, salt: ArrayBuffer) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
    salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function importDataKey(rawKey: ArrayBuffer) {
  return crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

function encodePayload(payload: ShareDashboardPayload) {
  return textEncoder.encode(JSON.stringify(payload))
}

function decodePayload(payload: ArrayBuffer) {
  return JSON.parse(textDecoder.decode(payload)) as ShareDashboardPayload
}

export async function createProtectedShareEnvelope(
  payload: ShareDashboardPayload,
  passphrase: string,
): Promise<{ envelope: SharePayloadEnvelope; dataKeyBase64: string }> {
  const keySalt = crypto.getRandomValues(new Uint8Array(16))
  const keyIv = crypto.getRandomValues(new Uint8Array(12))
  const payloadIv = crypto.getRandomValues(new Uint8Array(12))
  const dataKey = crypto.getRandomValues(new Uint8Array(32))

  const wrappingKey = await deriveWrappingKey(passphrase, toArrayBuffer(keySalt))
  const wrappedDataKey = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(keyIv) },
      wrappingKey,
      toArrayBuffer(dataKey),
    ),
  )
  const dataKeyCrypto = await importDataKey(toArrayBuffer(dataKey))
  const payloadCiphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(payloadIv) },
      dataKeyCrypto,
      encodePayload(payload),
    ),
  )

  return {
    dataKeyBase64: bytesToBase64(dataKey),
    envelope: {
      version: 1,
      keySalt: bytesToBase64(keySalt),
      keyIv: bytesToBase64(keyIv),
      wrappedDataKey: bytesToBase64(wrappedDataKey),
      payloadIv: bytesToBase64(payloadIv),
      payloadCiphertext: bytesToBase64(payloadCiphertext),
    },
  }
}

export async function decryptProtectedShareEnvelope(
  envelope: SharePayloadEnvelope,
  passphrase: string,
): Promise<ShareDashboardPayload> {
  const wrappingKey = await deriveWrappingKey(passphrase, toArrayBuffer(base64ToBytes(envelope.keySalt)))
  const dataKey = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(base64ToBytes(envelope.keyIv)) },
      wrappingKey,
      toArrayBuffer(base64ToBytes(envelope.wrappedDataKey)),
    ),
  )
  const dataKeyCrypto = await importDataKey(toArrayBuffer(dataKey))
  const payload = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(base64ToBytes(envelope.payloadIv)) },
    dataKeyCrypto,
    toArrayBuffer(base64ToBytes(envelope.payloadCiphertext)),
  )
  return decodePayload(payload)
}

export async function reencryptProtectedShareEnvelope(
  payload: ShareDashboardPayload,
  dataKeyBase64: string,
  envelope: SharePayloadEnvelope,
): Promise<SharePayloadEnvelope> {
  const dataKey = await importDataKey(toArrayBuffer(base64ToBytes(dataKeyBase64)))
  const payloadIv = crypto.getRandomValues(new Uint8Array(12))
  const payloadCiphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(payloadIv) },
      dataKey,
      encodePayload(payload),
    ),
  )

  return {
    ...envelope,
    payloadIv: bytesToBase64(payloadIv),
    payloadCiphertext: bytesToBase64(payloadCiphertext),
  }
}

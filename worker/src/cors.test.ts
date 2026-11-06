import { describe, expect, it } from 'vitest'
import { corsHeaders } from './cors'

describe('corsHeaders', () => {
  it('allows Mentell hosted PWA origins', () => {
    const headers = corsHeaders({}, 'https://projects.slt.ong', 'POST, OPTIONS')
    expect(headers['Access-Control-Allow-Origin']).toBe('https://projects.slt.ong')
  })

  it('allows Tauri desktop WebView origin', () => {
    const headers = corsHeaders({}, 'http://tauri.localhost', 'POST, OPTIONS')
    expect(headers['Access-Control-Allow-Origin']).toBe('http://tauri.localhost')
  })

  it('allows local Vite dev', () => {
    const headers = corsHeaders({}, 'http://localhost:5173', 'POST, OPTIONS')
    expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173')
  })

  it('rejects unknown origins', () => {
    const headers = corsHeaders({}, 'https://evil.example.com', 'POST, OPTIONS')
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined()
  })
})

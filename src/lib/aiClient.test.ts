import { describe, it, expect } from 'vitest'
import { extractAiText } from './aiClient'

describe('extractAiText', () => {
  it('extracts direct string input', () => {
    expect(extractAiText('hello world')).toBe('hello world')
  })

  it('extracts from object with response string field', () => {
    expect(extractAiText({ response: 'hello from response' })).toBe('hello from response')
  })

  it('extracts from object with text string field', () => {
    expect(extractAiText({ text: 'hello from text' })).toBe('hello from text')
  })

  it('extracts from OpenAI-style choices array', () => {
    const input = {
      choices: [
        {
          message: {
            content: 'hello from choices',
          },
        },
      ],
    }
    expect(extractAiText(input)).toBe('hello from choices')
  })

  it('returns empty string for null or undefined', () => {
    expect(extractAiText(null)).toBe('')
    expect(extractAiText(undefined)).toBe('')
  })

  it('returns empty string for primitives other than string', () => {
    expect(extractAiText(42)).toBe('')
    expect(extractAiText(true)).toBe('')
    expect(extractAiText(false)).toBe('')
  })

  it('returns empty string for arrays', () => {
    expect(extractAiText(['hello'])).toBe('')
  })

  it('returns empty string for objects without matching keys', () => {
    expect(extractAiText({ foo: 'bar' })).toBe('')
    expect(extractAiText({})).toBe('')
  })

  it('returns empty string for choices array with no elements', () => {
    expect(extractAiText({ choices: [] })).toBe('')
  })

  it('returns empty string for choices array without message object', () => {
    expect(extractAiText({ choices: [{ foo: 'bar' }] })).toBe('')
  })

  it('returns empty string for message without content string', () => {
    expect(extractAiText({ choices: [{ message: {} }] })).toBe('')
    expect(extractAiText({ choices: [{ message: { content: 123 } }] })).toBe('')
  })
})

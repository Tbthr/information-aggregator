import { describe, it, expect } from 'bun:test'
import { resolveEnvVars } from './resolve-env'

describe('resolveEnvVars', () => {
  it('replaces env var placeholders', () => {
    const input = { apiKey: '${TEST_API_KEY}' }
    process.env.TEST_API_KEY = 'secret123'
    const result = resolveEnvVars(input)
    expect(result).toEqual({ apiKey: 'secret123' })
  })

  it('returns empty string for missing env vars', () => {
    const input = { apiKey: '${MISSING_KEY}' }
    const result = resolveEnvVars(input)
    expect(result).toEqual({ apiKey: '' })
  })
})

import { describe, it, expect } from 'vitest'
import { generateSiteId, isValidSiteId, normalizeDomain } from '../src/lib/website-connection/site-id'
import { canTransition, CONNECTION_STEPS, isTerminalStep } from '../src/lib/website-connection/status'

describe('site-id', () => {
  it('generates a valid site_id', () => {
    const id = generateSiteId()
    expect(isValidSiteId(id)).toBe(true)
    expect(id).toMatch(/^site_[a-z0-9]{8}$/)
  })

  it('generates unique ids', () => {
    const set = new Set(Array.from({ length: 100 }, () => generateSiteId()))
    expect(set.size).toBe(100)
  })

  it('validates format', () => {
    expect(isValidSiteId('site_7e29ac19')).toBe(true)
    expect(isValidSiteId('site_ABC')).toBe(false)
    expect(isValidSiteId('site_123456789')).toBe(false)
    expect(isValidSiteId(null)).toBe(false)
    expect(isValidSiteId('uuid')).toBe(false)
  })

  it('normalizes domains', () => {
    expect(normalizeDomain('https://www.Example.cz/path')).toBe('example.cz')
    expect(normalizeDomain('www.example.cz')).toBe('example.cz')
    expect(normalizeDomain('example.cz:8080')).toBe('example.cz')
  })
})

describe('connection status transitions', () => {
  it('allows the happy path', () => {
    expect(canTransition('DRAFT', 'AUDITING')).toBe(true)
    expect(canTransition('AUDITING', 'READY')).toBe(true)
    expect(canTransition('READY', 'INSTALLING')).toBe(true)
    expect(canTransition('INSTALLING', 'VERIFYING')).toBe(true)
    expect(canTransition('VERIFYING', 'CONNECTED')).toBe(true)
    expect(canTransition('CONNECTED', 'DISCONNECTED')).toBe(true)
    expect(canTransition('DISCONNECTED', 'READY')).toBe(true)
  })

  it('rejects invalid transitions', () => {
    expect(canTransition('DRAFT', 'CONNECTED')).toBe(false)
    expect(canTransition('CONNECTED', 'DRAFT')).toBe(false)
    expect(canTransition('FAILED', 'CONNECTED')).toBe(false)
  })

  it('allows failure paths', () => {
    expect(canTransition('DRAFT', 'FAILED')).toBe(true)
    expect(canTransition('INSTALLING', 'FAILED')).toBe(true)
    expect(canTransition('VERIFYING', 'DEGRADED')).toBe(true)
    expect(canTransition('DEGRADED', 'CONNECTED')).toBe(true)
  })
})

describe('connection steps', () => {
  it('has the required steps in order', () => {
    const keys = CONNECTION_STEPS.map((s) => s.key)
    expect(keys[0]).toBe('DISCOVERY')
    expect(keys[keys.length - 1]).toBe('COMPLETE')
    expect(keys).toContain('CONNECTOR_INSTALL')
    expect(keys).toContain('FORM_CONNECT')
    expect(keys).toContain('HEALTH_CHECK')
  })

  it('marks terminal steps', () => {
    expect(isTerminalStep('DONE')).toBe(true)
    expect(isTerminalStep('FAILED')).toBe(true)
    expect(isTerminalStep('SKIPPED')).toBe(true)
    expect(isTerminalStep('RUNNING')).toBe(false)
    expect(isTerminalStep('PENDING')).toBe(false)
  })
})

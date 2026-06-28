import { describe, it, expect } from 'vitest'
import { createId, newId } from './id'

describe('createId', () => {
  it('prefixes the id with the given type', () => {
    expect(createId('gauge')).toMatch(/^gauge_/)
  })

  it('yields a unique id for every widget in a synchronous map (regression #1646)', () => {
    const widgets = [{ type: 'gauge' }, { type: 'gauge' }, { type: 'gauge' }]
    const ids = widgets.map((w) => createId(w.type))
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('newId', () => {
  it('returns distinct ids on successive calls', () => {
    expect(newId()).not.toBe(newId())
  })
})

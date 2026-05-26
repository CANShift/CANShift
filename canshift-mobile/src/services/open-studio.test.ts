// open-studio.test.ts — URL resolution + browser-open dispatch.

import { getStudioUrl, STUDIO_URL_CANDIDATES } from './open-studio'

describe('STUDIO_URL_CANDIDATES', () => {
  it('lists canshift.local before the static AP gateway', () => {
    expect(STUDIO_URL_CANDIDATES[0]).toBe('http://canshift.local/')
    expect(STUDIO_URL_CANDIDATES[1]).toBe('http://192.168.4.1/')
  })

  it('every candidate is plain http (matches firmware listener)', () => {
    for (const url of STUDIO_URL_CANDIDATES) {
      expect(url.startsWith('http://')).toBe(true)
    }
  })
})

describe('getStudioUrl', () => {
  it('returns the mDNS hostname as the preferred URL', () => {
    expect(getStudioUrl()).toBe('http://canshift.local/')
  })
})

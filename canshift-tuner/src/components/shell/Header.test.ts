import { describe, it, expect } from 'vitest'
import { SECTION_TITLES } from './Header'
import { ROUTE_PATHS } from '../../constants/routes'

describe('SECTION_TITLES', () => {
  it('only maps real route paths', () => {
    const routes = new Set<string>(ROUTE_PATHS)
    for (const path of Object.keys(SECTION_TITLES)) {
      expect(routes.has(path), `'${path}' is not a route in App.tsx`).toBe(true)
    }
  })

  it('has a title for every route', () => {
    for (const path of ROUTE_PATHS) {
      expect(SECTION_TITLES[path]).toBeTruthy()
    }
  })
})

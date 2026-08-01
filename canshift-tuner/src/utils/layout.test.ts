import { describe, expect, it } from 'vitest'
import type { GridPlacement } from '@tmbk/canshift-core'
import { placementsOverlap } from '@tmbk/canshift-core'
import { autoPlace, resolveCollisions, type IdentifiedPlacement } from './layout'

const placement = (col: number, colSpan: number, row: number, rowSpan: number): GridPlacement => ({
  col,
  colSpan,
  row,
  rowSpan,
})

describe('autoPlace', () => {
  it('places at the origin on an empty grid', () => {
    expect(autoPlace({ colSpan: 6, rowSpan: 6 }, [])).toEqual({ col: 0, row: 0 })
  })

  it('scans row-major for the first free slot', () => {
    const occupied = [placement(0, 6, 0, 6)]
    expect(autoPlace({ colSpan: 6, rowSpan: 6 }, occupied)).toEqual({ col: 6, row: 0 })
  })

  it('drops to the next row when the first is full', () => {
    const occupied = [placement(0, 6, 0, 6), placement(6, 6, 0, 6)]
    expect(autoPlace({ colSpan: 6, rowSpan: 6 }, occupied)).toEqual({ col: 0, row: 6 })
  })

  it('returns null when nothing fits', () => {
    const occupied = [placement(0, 12, 0, 12)]
    expect(autoPlace({ colSpan: 6, rowSpan: 6 }, occupied)).toBeNull()
  })
})

describe('resolveCollisions', () => {
  it('leaves non-overlapping placements untouched', () => {
    const moved: IdentifiedPlacement = { id: 'a', ...placement(0, 6, 0, 6) }
    const others: IdentifiedPlacement[] = [{ id: 'b', ...placement(6, 6, 0, 6) }]
    expect(resolveCollisions(moved, others).size).toBe(0)
  })

  it('pushes an overlapping victim out of the moved widget', () => {
    const moved: IdentifiedPlacement = { id: 'a', ...placement(0, 6, 0, 6) }
    const others: IdentifiedPlacement[] = [{ id: 'b', ...placement(3, 6, 0, 6) }]
    const changes = resolveCollisions(moved, others)
    const b = changes.get('b')
    expect(b).toBeDefined()
    if (b) expect(placementsOverlap(moved, { ...placement(b.col, 6, b.row, 6) })).toBe(false)
  })
})

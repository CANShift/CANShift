import {
  LAYOUT_GRID,
  clampGridPlacement,
  isSpanOverflowing,
  nearestTrack,
  placementsOverlap,
  resolveGridRect,
} from '../layout-grid.js'
import type { GridPlacement } from '../layout-grid.js'

const CROWPANEL = { width: 320, height: 240 }
const CROWPANEL_BELOW_TOPBAR = { width: 320, height: 224 }

const place = (col: number, colSpan: number, row: number, rowSpan: number): GridPlacement => ({
  col,
  colSpan,
  row,
  rowSpan,
})

describe('LAYOUT_GRID constants', () => {
  it('matches the restyle handoff §4 widget grammar', () => {
    expect(LAYOUT_GRID.COLUMNS).toBe(12)
    expect(LAYOUT_GRID.GUTTER).toBe(12)
    expect(LAYOUT_GRID.FRAME_PADDING).toBe(16)
  })
})

describe('resolveGridRect — crowpanel-28 (320 wide, 25 px column pitch)', () => {
  it('resolves a full-width span to the padded frame', () => {
    const rect = resolveGridRect(place(0, 12, 0, 12), CROWPANEL)
    expect(rect.x).toBe(LAYOUT_GRID.FRAME_PADDING)
    expect(rect.w).toBe(CROWPANEL.width - 2 * LAYOUT_GRID.FRAME_PADDING)
    expect(rect.y).toBe(LAYOUT_GRID.FRAME_PADDING)
    expect(rect.h).toBe(CROWPANEL.height - 2 * LAYOUT_GRID.FRAME_PADDING)
  })

  it('resolves two half-width spans separated by exactly one gutter', () => {
    const left = resolveGridRect(place(0, 6, 0, 6), CROWPANEL)
    const right = resolveGridRect(place(6, 6, 0, 6), CROWPANEL)
    expect(left.x).toBe(16)
    expect(left.w).toBe(138)
    expect(right.x).toBe(166)
    expect(right.w).toBe(138)
    expect(right.x - (left.x + left.w)).toBe(LAYOUT_GRID.GUTTER)
    expect(right.x + right.w).toBe(CROWPANEL.width - LAYOUT_GRID.FRAME_PADDING)
  })

  it('resolves a single column to pitch minus gutter', () => {
    const rect = resolveGridRect(place(0, 1, 0, 1), CROWPANEL)
    expect(rect.w).toBe(13)
  })

  it('resolves rows with an exact 17 px pitch on the 224 px area below the top bar', () => {
    const rect = resolveGridRect(place(0, 12, 6, 3), CROWPANEL_BELOW_TOPBAR)
    expect(rect.y).toBe(16 + 102)
    expect(rect.h).toBe(3 * 17 - LAYOUT_GRID.GUTTER)
  })

  it('never renders outside the padded frame for any valid placement', () => {
    const spansPerAxis = (tracks: number): [number, number][] => {
      const pairs: [number, number][] = []
      for (let track = 0; track < tracks; track++) {
        for (let span = 1; span <= tracks - track; span++) pairs.push([track, span])
      }
      return pairs
    }
    const colPairs = spansPerAxis(LAYOUT_GRID.COLUMNS)
    const rowPairs = spansPerAxis(LAYOUT_GRID.ROWS)
    const placements = colPairs.flatMap(([col, colSpan]) =>
      rowPairs.map(([row, rowSpan]) => place(col, colSpan, row, rowSpan))
    )
    for (const placement of placements) {
      const rect = resolveGridRect(placement, CROWPANEL)
      expect(rect.x).toBeGreaterThanOrEqual(LAYOUT_GRID.FRAME_PADDING)
      expect(rect.y).toBeGreaterThanOrEqual(LAYOUT_GRID.FRAME_PADDING)
      expect(rect.x + rect.w).toBeLessThanOrEqual(CROWPANEL.width - LAYOUT_GRID.FRAME_PADDING)
      expect(rect.y + rect.h).toBeLessThanOrEqual(CROWPANEL.height - LAYOUT_GRID.FRAME_PADDING)
      expect(rect.w).toBeGreaterThan(0)
      expect(rect.h).toBeGreaterThan(0)
    }
  })

  it('adjacent spans tile without overlap on a non-divisible area height', () => {
    const area = { width: 320, height: 230 }
    for (let row = 0; row < LAYOUT_GRID.ROWS - 1; row++) {
      const upper = resolveGridRect(place(0, 12, row, 1), area)
      const lower = resolveGridRect(place(0, 12, row + 1, 1), area)
      expect(lower.y - (upper.y + upper.h)).toBe(LAYOUT_GRID.GUTTER)
    }
  })

  it('clamps degenerate areas to 1 px segments instead of going negative', () => {
    const rect = resolveGridRect(place(0, 1, 0, 1), { width: 0, height: 0 })
    expect(rect.w).toBe(1)
    expect(rect.h).toBe(1)
  })
})

describe('nearestTrack', () => {
  it('maps resolved track origins back to their track index', () => {
    for (let col = 0; col <= LAYOUT_GRID.COLUMNS; col++) {
      const offset = 16 + col * 25
      expect(nearestTrack(offset, CROWPANEL.width, LAYOUT_GRID.COLUMNS)).toBe(col)
    }
  })

  it('rounds to the closest track', () => {
    expect(nearestTrack(16 + 12, CROWPANEL.width, LAYOUT_GRID.COLUMNS)).toBe(0)
    expect(nearestTrack(16 + 13, CROWPANEL.width, LAYOUT_GRID.COLUMNS)).toBe(1)
  })

  it('clamps offsets outside the frame', () => {
    expect(nearestTrack(-100, CROWPANEL.width, LAYOUT_GRID.COLUMNS)).toBe(0)
    expect(nearestTrack(1000, CROWPANEL.width, LAYOUT_GRID.COLUMNS)).toBe(LAYOUT_GRID.COLUMNS)
  })

  it('returns 0 for a degenerate area', () => {
    expect(nearestTrack(50, 0, LAYOUT_GRID.COLUMNS)).toBe(0)
  })
})

describe('clampGridPlacement', () => {
  it('keeps a valid placement untouched', () => {
    expect(clampGridPlacement(place(6, 6, 9, 3))).toEqual(place(6, 6, 9, 3))
  })

  it('pulls an off-grid placement back inside', () => {
    expect(clampGridPlacement(place(11, 4, -2, 0))).toEqual(place(8, 4, 0, 1))
  })

  it('caps spans at the grid size', () => {
    expect(clampGridPlacement(place(0, 20, 0, 20))).toEqual(place(0, 12, 0, 12))
  })

  it('rounds fractional inputs', () => {
    expect(clampGridPlacement(place(1.4, 2.6, 0.5, 1.2))).toEqual(place(1, 3, 1, 1))
  })
})

describe('placementsOverlap', () => {
  it('detects an overlap', () => {
    expect(placementsOverlap(place(0, 6, 0, 6), place(5, 6, 5, 6))).toBe(true)
  })

  it('treats edge-adjacent placements as non-overlapping', () => {
    expect(placementsOverlap(place(0, 6, 0, 6), place(6, 6, 0, 6))).toBe(false)
    expect(placementsOverlap(place(0, 6, 0, 6), place(0, 6, 6, 6))).toBe(false)
  })
})

describe('isSpanOverflowing', () => {
  it('accepts placements inside the grid', () => {
    expect(isSpanOverflowing(place(0, 12, 0, 12))).toBe(false)
    expect(isSpanOverflowing(place(11, 1, 11, 1))).toBe(false)
  })

  it('flags spans past the grid edge', () => {
    expect(isSpanOverflowing(place(8, 5, 0, 1))).toBe(true)
    expect(isSpanOverflowing(place(0, 1, 10, 3))).toBe(true)
  })

  it('flags negative origins', () => {
    expect(isSpanOverflowing(place(-1, 2, 0, 1))).toBe(true)
    expect(isSpanOverflowing(place(0, 1, -1, 2))).toBe(true)
  })
})

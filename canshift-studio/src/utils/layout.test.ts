// layout.test.ts — unit tests for layout utilities

import { describe, it, expect } from 'vitest'
import {
  SNAP_GRID,
  LAYOUT_GAP,
  snapToGrid,
  rectsOverlap,
  autoPlace,
  resolveCollisions,
  type LayoutRect,
} from './layout'

// ---------------------------------------------------------------------------
// snapToGrid
// ---------------------------------------------------------------------------

describe('snapToGrid', () => {
  it('rounds to nearest grid line', () => {
    expect(snapToGrid(0)).toBe(0)
    expect(snapToGrid(4)).toBe(4)
    expect(snapToGrid(5)).toBe(4)
    expect(snapToGrid(6)).toBe(8)
    expect(snapToGrid(3)).toBe(4)
  })

  it('accepts custom grid size', () => {
    expect(snapToGrid(10, 8)).toBe(8)
    expect(snapToGrid(12, 8)).toBe(16)
  })
})

// ---------------------------------------------------------------------------
// rectsOverlap
// ---------------------------------------------------------------------------

describe('rectsOverlap', () => {
  const a: LayoutRect = { id: 'a', x: 0, y: 0, w: 80, h: 56 }

  it('returns true for clearly overlapping rects', () => {
    const b: LayoutRect = { id: 'b', x: 40, y: 28, w: 80, h: 56 }
    expect(rectsOverlap(a, b)).toBe(true)
  })

  it('returns false for rects that are separated', () => {
    const b: LayoutRect = { id: 'b', x: 80 + LAYOUT_GAP + 1, y: 0, w: 80, h: 56 }
    expect(rectsOverlap(a, b)).toBe(false)
  })

  it('returns false for rects that share only an edge (touching, not overlapping)', () => {
    // LAYOUT_GAP is 0 so touching edge means adjacent, not overlapping
    const b: LayoutRect = { id: 'b', x: 80, y: 0, w: 80, h: 56 }
    // a ends at x=80, b starts at x=80 → edge shared → not overlapping
    expect(rectsOverlap(a, b)).toBe(false)
  })

  it('returns true for fully contained rect', () => {
    const b: LayoutRect = { id: 'b', x: 10, y: 10, w: 20, h: 20 }
    expect(rectsOverlap(a, b)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// autoPlace
// ---------------------------------------------------------------------------

describe('autoPlace', () => {
  const canvasW = 320
  const canvasH = 224

  it('places first widget at (0, 0) on empty canvas', () => {
    const pos = autoPlace({ w: 80, h: 56 }, [], canvasW, canvasH)
    expect(pos).toEqual({ x: 0, y: 0 })
  })

  it('places second widget adjacent to first (no gap)', () => {
    const first: LayoutRect = { id: 'w1', x: 0, y: 0, w: 80, h: 56 }
    const pos = autoPlace({ w: 80, h: 56 }, [first], canvasW, canvasH)
    // Next x step is SNAP_GRID = 4; must clear x=0..80 so next valid x is 80
    expect(pos).not.toBeNull()
    if (pos !== null) {
      expect(pos.x).toBeGreaterThanOrEqual(80)
    }
  })

  it('returns null when canvas is fully occupied', () => {
    // One large widget that fills the entire canvas
    const full: LayoutRect = { id: 'w1', x: 0, y: 0, w: canvasW, h: canvasH }
    const pos = autoPlace({ w: 80, h: 56 }, [full], canvasW, canvasH)
    expect(pos).toBeNull()
  })

  it('places widget below when row is full', () => {
    // Fill first row (y=0) with 4 widgets of w=80
    const others: LayoutRect[] = [
      { id: 'w1', x: 0, y: 0, w: 80, h: 56 },
      { id: 'w2', x: 80, y: 0, w: 80, h: 56 },
      { id: 'w3', x: 160, y: 0, w: 80, h: 56 },
      { id: 'w4', x: 240, y: 0, w: 80, h: 56 },
    ]
    const pos = autoPlace({ w: 80, h: 56 }, others, canvasW, canvasH)
    expect(pos).not.toBeNull()
    if (pos !== null) {
      expect(pos.y).toBeGreaterThanOrEqual(56)
    }
  })
})

// ---------------------------------------------------------------------------
// resolveCollisions
// ---------------------------------------------------------------------------

describe('resolveCollisions', () => {
  const canvasW = 320
  const canvasH = 224

  it('places moved widget at exact requested position', () => {
    const moved: LayoutRect = { id: 'a', x: 0, y: 0, w: 80, h: 56 }
    const result = resolveCollisions(moved, 40, 0, [], canvasW, canvasH)
    expect(result.get('a')).toEqual({ x: 40, y: 0 })
  })

  it('pushes overlapping widget away from moved widget', () => {
    const moved: LayoutRect = { id: 'a', x: 0, y: 0, w: 80, h: 56 }
    const other: LayoutRect = { id: 'b', x: 60, y: 0, w: 80, h: 56 }
    const result = resolveCollisions(moved, 40, 0, [other], canvasW, canvasH)
    const newA = result.get('a')
    const newB = result.get('b')

    // moved stays where requested
    expect(newA).toEqual({ x: 40, y: 0 })

    if (newA !== undefined && newB !== undefined) {
      // b must no longer overlap a
      const aRect: LayoutRect = { id: 'a', x: newA.x, y: newA.y, w: 80, h: 56 }
      const bRect: LayoutRect = { id: 'b', x: newB.x, y: newB.y, w: 80, h: 56 }
      expect(rectsOverlap(aRect, bRect)).toBe(false)
    }
  })

  it('never moves the anchor widget', () => {
    const moved: LayoutRect = { id: 'a', x: 0, y: 0, w: 80, h: 56 }
    const other1: LayoutRect = { id: 'b', x: 10, y: 0, w: 80, h: 56 }
    const other2: LayoutRect = { id: 'c', x: 20, y: 0, w: 80, h: 56 }
    const result = resolveCollisions(moved, 0, 0, [other1, other2], canvasW, canvasH)
    expect(result.get('a')).toEqual({ x: 0, y: 0 })
  })

  it('does not include unchanged widgets in result', () => {
    const moved: LayoutRect = { id: 'a', x: 0, y: 0, w: 80, h: 56 }
    // Widget far away — should not be affected
    const farAway: LayoutRect = { id: 'b', x: 240, y: 168, w: 80, h: 56 }
    const result = resolveCollisions(moved, 0, 0, [farAway], canvasW, canvasH)
    expect(result.has('b')).toBe(false)
  })

  it('keeps all results within canvas bounds', () => {
    const moved: LayoutRect = { id: 'a', x: 0, y: 0, w: 80, h: 56 }
    const others: LayoutRect[] = [
      { id: 'b', x: 10, y: 0, w: 80, h: 56 },
      { id: 'c', x: 20, y: 0, w: 80, h: 56 },
      { id: 'd', x: 30, y: 0, w: 80, h: 56 },
    ]
    const result = resolveCollisions(moved, 0, 0, others, canvasW, canvasH)
    for (const [, pos] of result) {
      expect(pos.x).toBeGreaterThanOrEqual(0)
      expect(pos.y).toBeGreaterThanOrEqual(0)
      expect(pos.x + 80).toBeLessThanOrEqual(canvasW)
      expect(pos.y + 56).toBeLessThanOrEqual(canvasH)
    }
  })

  it('pushes overlapping widget LEFT when the moved widget approaches from the right', () => {
    // 'b' sits in the middle of the canvas; 'a' moves into b from the right.
    // Pushing right would clip b out of bounds, so the algorithm should pick
    // the smaller-displacement direction — here, left.
    const other: LayoutRect = { id: 'b', x: 80, y: 80, w: 80, h: 56 }
    const moved: LayoutRect = { id: 'a', x: 200, y: 80, w: 80, h: 56 }
    const result = resolveCollisions(moved, 120, 80, [other], canvasW, canvasH)
    const newB = result.get('b')

    expect(newB).toBeDefined()
    if (newB !== undefined) {
      // b must clear a (a now at x=120, w=80 → ends at 200), so b's right edge ≤ 120
      expect(newB.x + 80).toBeLessThanOrEqual(120)
      const aRect: LayoutRect = { id: 'a', x: 120, y: 80, w: 80, h: 56 }
      const bRect: LayoutRect = { id: 'b', x: newB.x, y: newB.y, w: 80, h: 56 }
      expect(rectsOverlap(aRect, bRect)).toBe(false)
    }
  })

  it('pushes overlapping widget UP when the moved widget approaches from below', () => {
    // 'b' sits at y=80; 'a' moves into b from below. Pushing down would clip b
    // out of bounds, so push up is preferred.
    const other: LayoutRect = { id: 'b', x: 80, y: 80, w: 80, h: 56 }
    const moved: LayoutRect = { id: 'a', x: 80, y: 168, w: 80, h: 56 }
    const result = resolveCollisions(moved, 80, 100, [other], canvasW, canvasH)
    const newB = result.get('b')

    expect(newB).toBeDefined()
    if (newB !== undefined) {
      // b's bottom edge ≤ a's top (100)
      expect(newB.y + 56).toBeLessThanOrEqual(100)
      const aRect: LayoutRect = { id: 'a', x: 80, y: 100, w: 80, h: 56 }
      const bRect: LayoutRect = { id: 'b', x: newB.x, y: newB.y, w: 80, h: 56 }
      expect(rectsOverlap(aRect, bRect)).toBe(false)
    }
  })

  it('terminates and displaces the anchor-overlapping widget even when cascade cannot fully resolve', () => {
    // Pathological scenario: pushing b away from anchor a lands b on c; pushing
    // b away from c lands b back on a — the algorithm caps at 8 passes and
    // returns the last state. Locks the termination contract (no infinite loop)
    // and that the moved widget's request is honoured.
    const moved: LayoutRect = { id: 'a', x: 40, y: 0, w: 80, h: 56 }
    const b: LayoutRect = { id: 'b', x: 40, y: 20, w: 80, h: 56 }
    const c: LayoutRect = { id: 'c', x: 40, y: 80, w: 160, h: 56 }
    const result = resolveCollisions(moved, 40, 0, [b, c], canvasW, canvasH)

    expect(result.get('a')).toEqual({ x: 40, y: 0 })
    // b must end up somewhere different from its starting position
    const newB = result.get('b')
    expect(newB).toBeDefined()
    if (newB !== undefined) {
      expect(newB).not.toEqual({ x: 40, y: 20 })
    }
  })
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('constants', () => {
  it('SNAP_GRID is 4', () => {
    expect(SNAP_GRID).toBe(4)
  })

  it('LAYOUT_GAP is 0 (adjacent widgets are allowed)', () => {
    expect(LAYOUT_GAP).toBe(0)
  })
})

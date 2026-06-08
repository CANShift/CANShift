// layout.ts — Non-overlapping widget layout utilities
//
// Rules enforced by this module:
//   - Widgets never overlap each other
//   - A fixed gap (LAYOUT_GAP) is maintained between every pair of widgets
//   - Positions are snapped to SNAP_GRID
//   - Warnings sit on top visually (z-order is handled in Canvas.tsx, not here)
//
// Entry points:
//   autoPlace(size, others, canvasW, canvasH) → first free grid position
//   resolveCollisions(moved, newX, newY, others, canvasW, canvasH) → Map of id→pos

export const LAYOUT_GAP = 0 // widgets can touch — adjacent is allowed, not overlapping
export const SNAP_GRID = 4 // drag snap granularity (firmware px) — GCD of min width (40) and min height (28)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LayoutRect {
  id: string
  x: number
  y: number
  w: number
  h: number
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

export function snapToGrid(v: number, grid = SNAP_GRID): number {
  return Math.round(v / grid) * grid
}

/** Snap up to the next grid line — ensures a minimum-gap push never lands short. */
function ceilToGrid(v: number, grid = SNAP_GRID): number {
  return Math.ceil(v / grid) * grid
}

/** Snap down to the previous grid line — for leftward/upward pushes. */
function floorToGrid(v: number, grid = SNAP_GRID): number {
  return Math.floor(v / grid) * grid
}

/** True when a and b overlap (or are closer than LAYOUT_GAP). */
export function rectsOverlap(a: LayoutRect, b: LayoutRect): boolean {
  const g = LAYOUT_GAP
  return a.x < b.x + b.w + g && a.x + a.w + g > b.x && a.y < b.y + b.h + g && a.y + a.h + g > b.y
}

/**
 * Push `victim` away from `anchor` until they no longer overlap.
 * Chooses the axis with the smallest displacement.
 * Returns the new position for victim (anchor is unchanged).
 */
function pushAway(
  anchor: LayoutRect,
  victim: LayoutRect,
  canvasW: number,
  canvasH: number
): { x: number; y: number } {
  const g = LAYOUT_GAP

  // Required displacement to clear on each side
  const pushRight = anchor.x + anchor.w + g - victim.x
  const pushLeft = victim.x + victim.w + g - anchor.x
  const pushDown = anchor.y + anchor.h + g - victim.y
  const pushUp = victim.y + victim.h + g - anchor.y

  const minH = Math.min(pushRight, pushLeft)
  const minV = Math.min(pushDown, pushUp)

  let nx = victim.x
  let ny = victim.y

  if (minH <= minV) {
    if (pushRight <= pushLeft) {
      nx = ceilToGrid(anchor.x + anchor.w + g) // push right — ceil so gap ≥ g
    } else {
      nx = floorToGrid(anchor.x - victim.w - g) // push left — floor so gap ≥ g
    }
  } else {
    if (pushDown <= pushUp) {
      ny = ceilToGrid(anchor.y + anchor.h + g) // push down — ceil so gap ≥ g
    } else {
      ny = floorToGrid(anchor.y - victim.h - g) // push up — floor so gap ≥ g
    }
  }

  return {
    x: clamp(nx, 0, canvasW - victim.w),
    y: clamp(ny, 0, canvasH - victim.h),
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Find the first grid-aligned position where a widget of `size` fits
 * without overlapping any of `others` (respecting LAYOUT_GAP).
 *
 * Scans left→right, top→bottom. Returns null if the canvas is full.
 */
export function autoPlace(
  size: { w: number; h: number },
  others: LayoutRect[],
  canvasW: number,
  canvasH: number
): { x: number; y: number } | null {
  for (let y = 0; y + size.h <= canvasH; y += SNAP_GRID) {
    for (let x = 0; x + size.w <= canvasW; x += SNAP_GRID) {
      const candidate: LayoutRect = { id: '__candidate__', x, y, w: size.w, h: size.h }
      if (!others.some((o) => rectsOverlap(candidate, o))) {
        return { x, y }
      }
    }
  }
  return null
}

/**
 * Place `moved` at (newX, newY) and cascade-push any widgets that now overlap.
 *
 * - The moved widget is the immovable anchor; other widgets are pushed away.
 * - Each pushed widget may trigger further pushes (cascade, max 8 passes).
 * - All results are snapped to SNAP_GRID and clamped to the canvas.
 *
 * Returns a Map of widget id → new {x, y}.
 * Only changed positions are included (moved widget always included).
 */
export function resolveCollisions(
  moved: LayoutRect,
  newX: number,
  newY: number,
  others: LayoutRect[],
  canvasW: number,
  canvasH: number
): Map<string, { x: number; y: number }> {
  // Working state — mutable copy of all positions
  const pos = new Map<string, LayoutRect>()
  pos.set(moved.id, { ...moved, x: newX, y: newY })
  for (const o of others) pos.set(o.id, { ...o })

  const MAX_PASSES = 8

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let dirty = false
    const all = Array.from(pos.values())

    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        // noUncheckedIndexedAccess — guard before use
        const aOrig = all[i]
        const bOrig = all[j]
        if (!aOrig || !bOrig) continue
        const a = pos.get(aOrig.id) ?? aOrig
        const b = pos.get(bOrig.id) ?? bOrig

        if (!rectsOverlap(a, b)) continue

        dirty = true

        // The moved widget is the anchor — never displace it
        if (a.id === moved.id) {
          const np = pushAway(a, b, canvasW, canvasH)
          pos.set(b.id, { id: b.id, x: np.x, y: np.y, w: b.w, h: b.h })
        } else if (b.id === moved.id) {
          const np = pushAway(b, a, canvasW, canvasH)
          pos.set(a.id, { id: a.id, x: np.x, y: np.y, w: a.w, h: a.h })
        } else {
          // Two non-moved widgets: push the smaller one to minimise disruption
          const smallerIsA = a.w * a.h <= b.w * b.h
          if (smallerIsA) {
            const np = pushAway(b, a, canvasW, canvasH)
            pos.set(a.id, { id: a.id, x: np.x, y: np.y, w: a.w, h: a.h })
          } else {
            const np = pushAway(a, b, canvasW, canvasH)
            pos.set(b.id, { id: b.id, x: np.x, y: np.y, w: b.w, h: b.h })
          }
        }
      }
    }

    if (!dirty) break
  }

  // Collect results — skip unchanged non-moved rects
  const result = new Map<string, { x: number; y: number }>()
  result.set(moved.id, { x: newX, y: newY })

  for (const [id, rect] of pos) {
    if (id === moved.id) continue
    const original = others.find((o) => o.id === id)
    if (original && (original.x !== rect.x || original.y !== rect.y)) {
      result.set(id, { x: rect.x, y: rect.y })
    }
  }

  return result
}

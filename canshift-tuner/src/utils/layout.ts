import type { GridPlacement } from '@tmbk/canshift-core'
import { LAYOUT_GRID, clampGridPlacement, placementsOverlap } from '@tmbk/canshift-core'

export interface IdentifiedPlacement extends GridPlacement {
  id: string
}

export interface SpanSize {
  colSpan: number
  rowSpan: number
}

export interface TrackPosition {
  col: number
  row: number
}

export const autoPlace = (
  size: SpanSize,
  others: readonly GridPlacement[]
): TrackPosition | null => {
  const colSpan = Math.min(size.colSpan, LAYOUT_GRID.COLUMNS)
  const rowSpan = Math.min(size.rowSpan, LAYOUT_GRID.ROWS)
  for (let row = 0; row + rowSpan <= LAYOUT_GRID.ROWS; row++) {
    for (let col = 0; col + colSpan <= LAYOUT_GRID.COLUMNS; col++) {
      const candidate: GridPlacement = { col, colSpan, row, rowSpan }
      if (!others.some((o) => placementsOverlap(candidate, o))) return { col, row }
    }
  }
  return null
}

const pushAway = (anchor: GridPlacement, victim: GridPlacement): GridPlacement => {
  const pushRight = anchor.col + anchor.colSpan - victim.col
  const pushLeft = victim.col + victim.colSpan - anchor.col
  const pushDown = anchor.row + anchor.rowSpan - victim.row
  const pushUp = victim.row + victim.rowSpan - anchor.row

  const minH = Math.min(pushRight, pushLeft)
  const minV = Math.min(pushDown, pushUp)

  let col = victim.col
  let row = victim.row

  if (minH <= minV) {
    col = pushRight <= pushLeft ? anchor.col + anchor.colSpan : anchor.col - victim.colSpan
  } else {
    row = pushDown <= pushUp ? anchor.row + anchor.rowSpan : anchor.row - victim.rowSpan
  }

  return clampGridPlacement({ ...victim, col, row })
}

const spanArea = (p: GridPlacement): number => p.colSpan * p.rowSpan

const pickVictim = (
  a: IdentifiedPlacement,
  b: IdentifiedPlacement,
  movedId: string
): [IdentifiedPlacement, IdentifiedPlacement] => {
  if (a.id === movedId) return [a, b]
  if (b.id === movedId) return [b, a]
  return spanArea(a) <= spanArea(b) ? [b, a] : [a, b]
}

const collidingPairs = (
  placements: IdentifiedPlacement[]
): [IdentifiedPlacement, IdentifiedPlacement][] => {
  const pairs: [IdentifiedPlacement, IdentifiedPlacement][] = []
  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      const a = placements[i]
      const b = placements[j]
      if (a && b && placementsOverlap(a, b)) pairs.push([a, b])
    }
  }
  return pairs
}

const MAX_PASSES = 8

export const resolveCollisions = (
  moved: IdentifiedPlacement,
  others: readonly IdentifiedPlacement[]
): Map<string, TrackPosition> => {
  const pos = new Map<string, IdentifiedPlacement>()
  pos.set(moved.id, { ...moved })
  for (const o of others) pos.set(o.id, { ...o })

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const pairs = collidingPairs(Array.from(pos.values()))
    if (pairs.length === 0) break
    for (const [a, b] of pairs) {
      const [anchor, victim] = pickVictim(a, b, moved.id)
      const shifted = pushAway(anchor, victim)
      pos.set(victim.id, { ...victim, col: shifted.col, row: shifted.row })
    }
  }

  const result = new Map<string, TrackPosition>()
  for (const [id, placement] of pos) {
    if (id === moved.id) continue
    const original = others.find((o) => o.id === id)
    if (original && (original.col !== placement.col || original.row !== placement.row)) {
      result.set(id, { col: placement.col, row: placement.row })
    }
  }

  return result
}

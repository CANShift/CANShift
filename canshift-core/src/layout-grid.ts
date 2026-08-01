export const LAYOUT_GRID = {
  COLUMNS: 12,
  ROWS: 12,
  GUTTER: 12,
  FRAME_PADDING: 16,
} as const

export interface GridArea {
  width: number
  height: number
}

export interface GridPlacement {
  col: number
  colSpan: number
  row: number
  rowSpan: number
}

export interface GridRect {
  x: number
  y: number
  w: number
  h: number
}

const clampInt = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

const contentSize = (size: number): number => Math.max(size - 2 * LAYOUT_GRID.FRAME_PADDING, 0)

const trackOffset = (track: number, content: number, tracks: number): number =>
  Math.round((track * (content + LAYOUT_GRID.GUTTER)) / tracks)

interface AxisSegment {
  origin: number
  length: number
}

const resolveAxis = (track: number, span: number, size: number, tracks: number): AxisSegment => {
  const content = contentSize(size)
  const start = trackOffset(track, content, tracks)
  const end = trackOffset(track + span, content, tracks) - LAYOUT_GRID.GUTTER
  return { origin: LAYOUT_GRID.FRAME_PADDING + start, length: Math.max(end - start, 1) }
}

export const resolveGridRect = (placement: GridPlacement, area: GridArea): GridRect => {
  const clamped = clampGridPlacement(placement)
  const cols = resolveAxis(clamped.col, clamped.colSpan, area.width, LAYOUT_GRID.COLUMNS)
  const rows = resolveAxis(clamped.row, clamped.rowSpan, area.height, LAYOUT_GRID.ROWS)
  return { x: cols.origin, y: rows.origin, w: cols.length, h: rows.length }
}

export const nearestTrack = (offset: number, size: number, tracks: number): number => {
  const content = contentSize(size)
  if (content === 0) return 0
  const raw = Math.round(
    ((offset - LAYOUT_GRID.FRAME_PADDING) * tracks) / (content + LAYOUT_GRID.GUTTER)
  )
  return clampInt(raw, 0, tracks)
}

export const clampGridPlacement = (placement: GridPlacement): GridPlacement => {
  const colSpan = clampInt(Math.round(placement.colSpan), 1, LAYOUT_GRID.COLUMNS)
  const rowSpan = clampInt(Math.round(placement.rowSpan), 1, LAYOUT_GRID.ROWS)
  const col = clampInt(Math.round(placement.col), 0, LAYOUT_GRID.COLUMNS - colSpan)
  const row = clampInt(Math.round(placement.row), 0, LAYOUT_GRID.ROWS - rowSpan)
  return { col, colSpan, row, rowSpan }
}

export const placementsOverlap = (a: GridPlacement, b: GridPlacement): boolean =>
  a.col < b.col + b.colSpan &&
  b.col < a.col + a.colSpan &&
  a.row < b.row + b.rowSpan &&
  b.row < a.row + a.rowSpan

export const isSpanOverflowing = (placement: GridPlacement): boolean =>
  placement.col < 0 ||
  placement.row < 0 ||
  placement.col + placement.colSpan > LAYOUT_GRID.COLUMNS ||
  placement.row + placement.rowSpan > LAYOUT_GRID.ROWS

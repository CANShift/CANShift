export const LAYOUT_GAP = 0
export const SNAP_GRID = 4

export interface LayoutRect {
  id: string
  x: number
  y: number
  w: number
  h: number
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v)

export const snapToGrid = (v: number, grid = SNAP_GRID): number => Math.round(v / grid) * grid

const ceilToGrid = (v: number, grid = SNAP_GRID): number => Math.ceil(v / grid) * grid

const floorToGrid = (v: number, grid = SNAP_GRID): number => Math.floor(v / grid) * grid

export const rectsOverlap = (a: LayoutRect, b: LayoutRect): boolean => {
  const g = LAYOUT_GAP
  return a.x < b.x + b.w + g && a.x + a.w + g > b.x && a.y < b.y + b.h + g && a.y + a.h + g > b.y
}

const pushAway = (
  anchor: LayoutRect,
  victim: LayoutRect,
  canvasW: number,
  canvasH: number
): { x: number; y: number } => {
  const g = LAYOUT_GAP

  const pushRight = anchor.x + anchor.w + g - victim.x
  const pushLeft = victim.x + victim.w + g - anchor.x
  const pushDown = anchor.y + anchor.h + g - victim.y
  const pushUp = victim.y + victim.h + g - anchor.y

  const minH = Math.min(pushRight, pushLeft)
  const minV = Math.min(pushDown, pushUp)

  let nx = victim.x
  let ny = victim.y

  if (minH <= minV) {
    nx =
      pushRight <= pushLeft
        ? ceilToGrid(anchor.x + anchor.w + g)
        : floorToGrid(anchor.x - victim.w - g)
  } else {
    ny =
      pushDown <= pushUp
        ? ceilToGrid(anchor.y + anchor.h + g)
        : floorToGrid(anchor.y - victim.h - g)
  }

  return {
    x: clamp(nx, 0, canvasW - victim.w),
    y: clamp(ny, 0, canvasH - victim.h),
  }
}

export const autoPlace = (
  size: { w: number; h: number },
  others: LayoutRect[],
  canvasW: number,
  canvasH: number
): { x: number; y: number } | null => {
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

const area = (r: LayoutRect): number => r.w * r.h

const moveRect = (r: LayoutRect, x: number, y: number): LayoutRect => ({ ...r, x, y })

const pickVictim = (a: LayoutRect, b: LayoutRect, movedId: string): [LayoutRect, LayoutRect] => {
  if (a.id === movedId) return [a, b]
  if (b.id === movedId) return [b, a]
  return area(a) <= area(b) ? [b, a] : [a, b]
}

const collidingPairs = (rects: LayoutRect[]): [LayoutRect, LayoutRect][] => {
  const pairs: [LayoutRect, LayoutRect][] = []
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i]
      const b = rects[j]
      if (a && b && rectsOverlap(a, b)) pairs.push([a, b])
    }
  }
  return pairs
}

const settlePass = (
  pos: Map<string, LayoutRect>,
  movedId: string,
  canvasW: number,
  canvasH: number
): boolean => {
  const pairs = collidingPairs(Array.from(pos.values()))
  for (const [a, b] of pairs) {
    const [anchor, victim] = pickVictim(a, b, movedId)
    const np = pushAway(anchor, victim, canvasW, canvasH)
    pos.set(victim.id, moveRect(victim, np.x, np.y))
  }
  return pairs.length > 0
}

export const resolveCollisions = (
  moved: LayoutRect,
  newX: number,
  newY: number,
  others: LayoutRect[],
  canvasW: number,
  canvasH: number
): Map<string, { x: number; y: number }> => {
  const pos = new Map<string, LayoutRect>()
  pos.set(moved.id, { ...moved, x: newX, y: newY })
  for (const o of others) pos.set(o.id, { ...o })

  const MAX_PASSES = 8
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const dirty = settlePass(pos, moved.id, canvasW, canvasH)
    if (!dirty) break
  }

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

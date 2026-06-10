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
    let dirty = false
    const all = Array.from(pos.values())

    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const aOrig = all[i]
        const bOrig = all[j]
        if (!aOrig || !bOrig) continue
        const a = pos.get(aOrig.id) ?? aOrig
        const b = pos.get(bOrig.id) ?? bOrig

        if (!rectsOverlap(a, b)) continue

        dirty = true

        if (a.id === moved.id) {
          const np = pushAway(a, b, canvasW, canvasH)
          pos.set(b.id, { id: b.id, x: np.x, y: np.y, w: b.w, h: b.h })
        } else if (b.id === moved.id) {
          const np = pushAway(b, a, canvasW, canvasH)
          pos.set(a.id, { id: a.id, x: np.x, y: np.y, w: a.w, h: a.h })
        } else {
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

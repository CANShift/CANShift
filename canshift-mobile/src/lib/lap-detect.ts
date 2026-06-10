export interface LineSegment {
  a: { lat: number; lng: number }
  b: { lat: number; lng: number }
}

export interface LapCrossingDetectorOptions {
  crossingHysteresisMs?: number
  enforceDirection?: boolean
  forwardBearingDeg?: number
}

export interface LapCrossingDetector {
  update(sample: { t: number; lat: number; lng: number }): number | null
  reset(): void
}

interface InternalState {
  prev: { t: number; lat: number; lng: number } | null
  lastCrossingMs: number
}

export const createLapCrossingDetector = (
  line: LineSegment,
  opts: LapCrossingDetectorOptions = {}
): LapCrossingDetector => {
  const hysteresis = opts.crossingHysteresisMs ?? 1500
  const enforceDir = opts.enforceDirection ?? true
  const lineBearingDeg = bearingDeg(line.a, line.b)
  const forwardBearingDeg = opts.forwardBearingDeg ?? (lineBearingDeg + 90) % 360

  const state: InternalState = { prev: null, lastCrossingMs: 0 }

  return {
    update(sample) {
      const prev = state.prev
      state.prev = sample

      if (prev === null) return null

      const crossing = segmentIntersect(
        { x: prev.lng, y: prev.lat },
        { x: sample.lng, y: sample.lat },
        { x: line.a.lng, y: line.a.lat },
        { x: line.b.lng, y: line.b.lat }
      )
      if (crossing === null) return null

      const interpolatedMs = prev.t + (sample.t - prev.t) * crossing.tAlong
      if (state.lastCrossingMs !== 0 && interpolatedMs - state.lastCrossingMs < hysteresis) {
        return null
      }

      if (enforceDir) {
        const travelBearing = bearingDeg(
          { lat: prev.lat, lng: prev.lng },
          { lat: sample.lat, lng: sample.lng }
        )
        const diff = signedAngleDelta(travelBearing, forwardBearingDeg)
        if (Math.abs(diff) > 90) return null
      }

      state.lastCrossingMs = interpolatedMs
      return interpolatedMs
    },
    reset() {
      state.prev = null
      state.lastCrossingMs = 0
    },
  }
}

interface Vec2 {
  x: number
  y: number
}

export const segmentIntersect = (
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  p4: Vec2
): { tAlong: number; x: number; y: number } | null => {
  const r = { x: p2.x - p1.x, y: p2.y - p1.y }
  const s = { x: p4.x - p3.x, y: p4.y - p3.y }
  const denom = cross(r, s)
  if (denom === 0) return null
  const qp = { x: p3.x - p1.x, y: p3.y - p1.y }
  const t = cross(qp, s) / denom
  const u = cross(qp, r) / denom
  if (t < 0 || t > 1 || u < 0 || u > 1) return null
  return { tAlong: t, x: p1.x + t * r.x, y: p1.y + t * r.y }
}

const cross = (a: Vec2, b: Vec2): number => {
  return a.x * b.y - a.y * b.x
}

export const bearingDeg = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number => {
  const dLat = b.lat - a.lat
  const dLng = b.lng - a.lng
  const rad = Math.atan2(dLng, dLat)
  const deg = (rad * 180) / Math.PI
  return (deg + 360) % 360
}

export const signedAngleDelta = (from: number, target: number): number => {
  let diff = target - from
  while (diff > 180) diff -= 360
  while (diff <= -180) diff += 360
  return diff
}

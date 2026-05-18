// lap-detect.ts — Start/finish line crossing detection (#845).
//
// Pure-geometry module. Given a circuit's start-finish line (two GPS
// points forming a segment) and a stream of GPS samples, emits a "lap
// finished" event each time the trace crosses the line in the forward
// direction.
//
// Algorithm:
//   - Each pair of consecutive samples forms a sub-segment of the trace.
//   - We test sub-segment ∩ start-finish line for an intersection.
//   - Crossings within `crossingHysteresisMs` of the previous crossing are
//     suppressed, so a finger-dragged GPS point bouncing across the line
//     can't produce two laps in a row.
//   - Direction is enforced via a cross-product sign: only the configured
//     forward bearing counts. This filters out the inevitable
//     "approaching the line from the wrong side" crossing on the warm-up
//     lap.
//
// Coordinates: we operate in raw lat/lng. At circuit scale (≤ 5 km), the
// Earth's curvature is negligible for crossing-detection accuracy — we
// don't bother projecting to a local cartesian frame for this v1.

export interface LineSegment {
  /** Start of the line — lat/lng. */
  a: { lat: number; lng: number }
  /** End of the line — lat/lng. */
  b: { lat: number; lng: number }
}

export interface LapCrossingDetectorOptions {
  /**
   * Minimum gap between two recorded crossings (ms). Picked to be larger
   * than the GPS sample period so a single physical crossing only counts
   * once even if the receiver reports two samples straddling the line.
   * Default: 1500 ms — ~7 samples at 5 Hz.
   */
  crossingHysteresisMs?: number
  /**
   * When true (default), only crossings travelling roughly in the
   * `forwardBearingDeg` direction are accepted. Set false to count any
   * crossing regardless of direction — useful for figure-eight courses.
   */
  enforceDirection?: boolean
  /**
   * Required direction of forward travel through the line, in compass
   * degrees [0, 360). Crossings whose heading differs by more than 90°
   * from this value are rejected (we test the cross-product sign, which
   * has the same effect for a planar segment). Defaults to the bearing
   * implied by `(line.a → line.b)` rotated 90° clockwise — i.e. assume
   * the line is laid out perpendicular to the racing direction.
   */
  forwardBearingDeg?: number
}

/**
 * Stateful crossing detector. Construct one per session; feed it samples
 * in chronological order via `update()`. Each return value is either
 * `null` (no crossing this sample) or a timestamp (the moment the trace
 * crossed the line, interpolated between the two samples that straddle it).
 */
export interface LapCrossingDetector {
  /**
   * Feed the next GPS sample. Returns the wall-clock ms at which the
   * trace crossed the line, or null if no crossing happened on this
   * segment. The returned timestamp is linearly interpolated between
   * the previous and current sample.
   */
  update(sample: { t: number; lat: number; lng: number }): number | null
  /** Drop the previous-sample state — call on session start. */
  reset(): void
}

interface InternalState {
  prev: { t: number; lat: number; lng: number } | null
  lastCrossingMs: number
}

/**
 * Build a detector for the given line + options. The detector is stateful
 * and not safe to share across sessions; reset() if the session restarts.
 */
export function createLapCrossingDetector(
  line: LineSegment,
  opts: LapCrossingDetectorOptions = {}
): LapCrossingDetector {
  const hysteresis = opts.crossingHysteresisMs ?? 1500
  const enforceDir = opts.enforceDirection ?? true
  // Default forward bearing = perpendicular to the line, pointing "right"
  // when looking from a→b. Many circuits lay the line perpendicular to the
  // straight, so this convention matches typical race-line geometry.
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

      // Hysteresis: a second crossing within the gap window is GPS bounce,
      // not a real lap. Drop it. The very first crossing is always allowed
      // (lastCrossingMs === 0 sentinel means "no prior crossing").
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
        // Accept crossings whose travel direction is within 90° of the
        // forward bearing. 90° is generous on purpose: GPS jitter near
        // the line can spin the per-segment bearing wildly.
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

// ---------------------------------------------------------------------------
// Geometry helpers (small + exported for the unit tests in the sibling file)
// ---------------------------------------------------------------------------

interface Vec2 {
  x: number
  y: number
}

/**
 * Returns the intersection of segments `p1→p2` and `p3→p4` if it exists,
 * or null. `tAlong` is the fractional position along `p1→p2` at which the
 * intersection lies (0 = p1, 1 = p2), useful for time interpolation.
 */
export function segmentIntersect(
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  p4: Vec2
): { tAlong: number; x: number; y: number } | null {
  const r = { x: p2.x - p1.x, y: p2.y - p1.y }
  const s = { x: p4.x - p3.x, y: p4.y - p3.y }
  const denom = cross(r, s)
  // Parallel / collinear — no single intersection point.
  if (denom === 0) return null
  const qp = { x: p3.x - p1.x, y: p3.y - p1.y }
  const t = cross(qp, s) / denom
  const u = cross(qp, r) / denom
  if (t < 0 || t > 1 || u < 0 || u > 1) return null
  return { tAlong: t, x: p1.x + t * r.x, y: p1.y + t * r.y }
}

function cross(a: Vec2, b: Vec2): number {
  return a.x * b.y - a.y * b.x
}

/**
 * Bearing from `a` to `b` in degrees [0, 360). 0 = north. Uses a planar
 * approximation — accurate enough at circuit scale.
 */
export function bearingDeg(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const dLat = b.lat - a.lat
  const dLng = b.lng - a.lng
  const rad = Math.atan2(dLng, dLat)
  const deg = (rad * 180) / Math.PI
  return (deg + 360) % 360
}

/**
 * Smallest signed difference between two compass bearings, in degrees.
 * Result is in `(-180, 180]`. Positive = `target` is clockwise of `from`.
 */
export function signedAngleDelta(from: number, target: number): number {
  let diff = target - from
  while (diff > 180) diff -= 360
  while (diff <= -180) diff += 360
  return diff
}

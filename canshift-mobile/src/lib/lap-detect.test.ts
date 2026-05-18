// lap-detect.test.ts — Coverage for the pure-geometry crossing detector
// from #845.

import {
  bearingDeg,
  createLapCrossingDetector,
  segmentIntersect,
  signedAngleDelta,
} from './lap-detect'

describe('segmentIntersect', () => {
  it('finds the intersection of two crossing segments', () => {
    const r = segmentIntersect({ x: 0, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }, { x: 4, y: 0 })
    expect(r).not.toBeNull()
    expect(r?.x).toBeCloseTo(2)
    expect(r?.y).toBeCloseTo(2)
    expect(r?.tAlong).toBeCloseTo(0.5)
  })

  it('returns null when segments do not cross', () => {
    expect(
      segmentIntersect({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })
    ).toBeNull()
  })

  it('returns null for parallel segments', () => {
    expect(
      segmentIntersect({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })
    ).toBeNull()
  })

  it('returns null for collinear segments', () => {
    expect(
      segmentIntersect({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 5, y: 0 })
    ).toBeNull()
  })

  it('reports tAlong = 0.25 when crossing near the start of segment 1', () => {
    const r = segmentIntersect({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 1, y: 1 }, { x: 1, y: -1 })
    expect(r?.tAlong).toBeCloseTo(0.25)
  })
})

describe('bearingDeg', () => {
  it('returns 0° for north', () => {
    expect(bearingDeg({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(0)
  })

  it('returns 90° for east', () => {
    expect(bearingDeg({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(90)
  })

  it('returns 180° for south', () => {
    expect(bearingDeg({ lat: 0, lng: 0 }, { lat: -1, lng: 0 })).toBeCloseTo(180)
  })

  it('returns 270° for west', () => {
    expect(bearingDeg({ lat: 0, lng: 0 }, { lat: 0, lng: -1 })).toBeCloseTo(270)
  })
})

describe('signedAngleDelta', () => {
  it('returns 0 for identical bearings', () => {
    expect(signedAngleDelta(45, 45)).toBe(0)
  })

  it('wraps across the 0/360 boundary', () => {
    expect(signedAngleDelta(350, 10)).toBe(20)
    expect(signedAngleDelta(10, 350)).toBe(-20)
  })

  it('returns 180 for opposite bearings', () => {
    expect(signedAngleDelta(0, 180)).toBe(180)
    expect(signedAngleDelta(180, 0)).toBe(180)
  })
})

describe('createLapCrossingDetector', () => {
  // Horizontal line at lat = 0, from lng -1 (point a) to lng +1 (point b).
  // a→b heads east, so "right of a→b" (the default forward bearing) is
  // south → travelling with lat decreasing is the forward direction.
  const line = { a: { lat: 0, lng: -1 }, b: { lat: 0, lng: 1 } }

  it('returns null on the first sample (no previous segment yet)', () => {
    const det = createLapCrossingDetector(line)
    expect(det.update({ t: 1000, lat: 0.5, lng: 0 })).toBeNull()
  })

  it('emits a crossing when the trace passes the line in the forward direction', () => {
    const det = createLapCrossingDetector(line)
    det.update({ t: 1000, lat: 0.5, lng: 0 })
    const crossing = det.update({ t: 2000, lat: -0.5, lng: 0 })
    expect(crossing).not.toBeNull()
    // Linear interpolation: line at lat=0, samples at +0.5 and -0.5 → midpoint t=1500.
    expect(crossing).toBeCloseTo(1500)
  })

  it('rejects a crossing in the reverse direction when enforceDirection is on', () => {
    const det = createLapCrossingDetector(line)
    det.update({ t: 1000, lat: -0.5, lng: 0 })
    const crossing = det.update({ t: 2000, lat: 0.5, lng: 0 })
    expect(crossing).toBeNull()
  })

  it('accepts crossings in any direction when enforceDirection is false', () => {
    const det = createLapCrossingDetector(line, { enforceDirection: false })
    det.update({ t: 1000, lat: -0.5, lng: 0 })
    expect(det.update({ t: 2000, lat: 0.5, lng: 0 })).not.toBeNull()
  })

  it('hysteresis suppresses a second crossing within the gap window', () => {
    const det = createLapCrossingDetector(line, { crossingHysteresisMs: 3000 })
    det.update({ t: 1000, lat: 0.5, lng: 0 })
    const first = det.update({ t: 2000, lat: -0.5, lng: 0 })
    expect(first).not.toBeNull()
    // Cross forward again 500 ms later — within hysteresis, should be dropped.
    det.update({ t: 2400, lat: 0.5, lng: 0.5 }) // off-line move
    const second = det.update({ t: 2500, lat: -0.5, lng: 0.5 })
    expect(second).toBeNull()
  })

  it('reset() clears the previous-sample state', () => {
    const det = createLapCrossingDetector(line)
    det.update({ t: 1000, lat: 0.5, lng: 0 })
    det.reset()
    // After reset, the next sample is "first" again and never produces a crossing.
    expect(det.update({ t: 2000, lat: -0.5, lng: 0 })).toBeNull()
  })

  it('returns null when the trace passes near the line without crossing it', () => {
    const det = createLapCrossingDetector(line)
    det.update({ t: 1000, lat: 0.1, lng: 0 })
    expect(det.update({ t: 2000, lat: 0.2, lng: 0 })).toBeNull()
  })
})

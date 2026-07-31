import { createLapCrossingDetector } from './lap-detect'
import { DEFAULT_HALF_WIDTH_M, startFinishLineFromPosition } from './start-finish-line'

const METERS_PER_DEG_AT_EQUATOR = 111_320

describe('startFinishLineFromPosition', () => {
  it('builds a line perpendicular to a northbound heading', () => {
    const { line, forwardBearingDeg } = startFinishLineFromPosition(
      { lat: 0, lng: 0, headingDeg: 0 },
      METERS_PER_DEG_AT_EQUATOR
    )
    expect(forwardBearingDeg).toBe(0)
    expect(line.a.lat).toBeCloseTo(0, 6)
    expect(line.a.lng).toBeCloseTo(-1, 6)
    expect(line.b.lat).toBeCloseTo(0, 6)
    expect(line.b.lng).toBeCloseTo(1, 6)
  })

  it('builds a line perpendicular to an eastbound heading', () => {
    const { line, forwardBearingDeg } = startFinishLineFromPosition(
      { lat: 0, lng: 0, headingDeg: 90 },
      111_320
    )
    expect(forwardBearingDeg).toBe(90)
    expect(line.a.lat).toBeCloseTo(1, 6)
    expect(line.a.lng).toBeCloseTo(0, 6)
    expect(line.b.lat).toBeCloseTo(-1, 6)
    expect(line.b.lng).toBeCloseTo(0, 6)
  })

  it('normalizes negative headings', () => {
    const { forwardBearingDeg } = startFinishLineFromPosition({ lat: 0, lng: 0, headingDeg: -90 })
    expect(forwardBearingDeg).toBe(270)
  })

  it('widens longitude offsets away from the equator', () => {
    const atEquator = startFinishLineFromPosition({ lat: 0, lng: 0, headingDeg: 0 })
    const atSixty = startFinishLineFromPosition({ lat: 60, lng: 0, headingDeg: 0 })
    const equatorSpan = atEquator.line.b.lng - atEquator.line.a.lng
    const sixtySpan = atSixty.line.b.lng - atSixty.line.a.lng
    expect(sixtySpan).toBeCloseTo(equatorSpan * 2, 6)
  })

  it('uses DEFAULT_HALF_WIDTH_M when no width is given', () => {
    const { line } = startFinishLineFromPosition({ lat: 0, lng: 0, headingDeg: 0 })
    const spanDeg = line.b.lng - line.a.lng
    expect(spanDeg).toBeCloseTo((2 * DEFAULT_HALF_WIDTH_M) / 111_320, 9)
  })

  it('yields finite coordinates at the poles', () => {
    for (const lat of [90, -90]) {
      const { line } = startFinishLineFromPosition({ lat, lng: 0, headingDeg: 45 })
      expect(Number.isFinite(line.a.lat)).toBe(true)
      expect(Number.isFinite(line.a.lng)).toBe(true)
      expect(Number.isFinite(line.b.lat)).toBe(true)
      expect(Number.isFinite(line.b.lng)).toBe(true)
    }
  })

  it('produces a detector setup that accepts crossings along the heading and rejects reverse ones', () => {
    const { line, forwardBearingDeg } = startFinishLineFromPosition({
      lat: 46.2,
      lng: 6.1,
      headingDeg: 0,
    })
    const forward = createLapCrossingDetector(line, { forwardBearingDeg })
    forward.update({ t: 1000, lat: 46.1999, lng: 6.1 })
    expect(forward.update({ t: 2000, lat: 46.2001, lng: 6.1 })).not.toBeNull()

    const reverse = createLapCrossingDetector(line, { forwardBearingDeg })
    reverse.update({ t: 1000, lat: 46.2001, lng: 6.1 })
    expect(reverse.update({ t: 2000, lat: 46.1999, lng: 6.1 })).toBeNull()
  })
})

import type { LineSegment } from './lap-detect'

export interface StartFinishLine {
  line: LineSegment
  forwardBearingDeg: number
}

export const DEFAULT_HALF_WIDTH_M = 25

const METERS_PER_DEG_LAT = 111_320
const MAX_ABS_LAT_FOR_LNG_SCALE = 89.9

const toRad = (deg: number): number => (deg * Math.PI) / 180

const clampLatForLngScale = (lat: number): number =>
  Math.min(Math.max(lat, -MAX_ABS_LAT_FOR_LNG_SCALE), MAX_ABS_LAT_FOR_LNG_SCALE)

const offsetPoint = (
  origin: { lat: number; lng: number },
  bearingDeg: number,
  distanceM: number
): { lat: number; lng: number } => {
  const bearingRad = toRad(bearingDeg)
  const dLat = (distanceM * Math.cos(bearingRad)) / METERS_PER_DEG_LAT
  const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos(toRad(clampLatForLngScale(origin.lat)))
  const dLng = (distanceM * Math.sin(bearingRad)) / metersPerDegLng
  return { lat: origin.lat + dLat, lng: origin.lng + dLng }
}

export const startFinishLineFromPosition = (
  position: { lat: number; lng: number; headingDeg: number },
  halfWidthM: number = DEFAULT_HALF_WIDTH_M
): StartFinishLine => {
  const heading = ((position.headingDeg % 360) + 360) % 360
  return {
    line: {
      a: offsetPoint(position, (heading + 270) % 360, halfWidthM),
      b: offsetPoint(position, (heading + 90) % 360, halfWidthM),
    },
    forwardBearingDeg: heading,
  }
}

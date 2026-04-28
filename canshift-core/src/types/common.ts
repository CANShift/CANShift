// common.ts — Shared primitive types used across all config entities

/** Hex color string — e.g. "#FF4444" */
export type HexColor = `#${string}`

/** Widget type discriminant */
export type WidgetType =
  | 'gauge'
  | 'label'
  | 'warning'
  | 'button'
  | 'timer'
  | 'bar'
  | 'gear'
  | 'image'

/** Widget position and size in pixels on a 320×240 canvas */
export interface WidgetLayout {
  x: number
  y: number
  w: number
  h: number
  zOrder: number
}

/** Widget visual style */
export interface WidgetStyle {
  primaryColor:   HexColor
  secondaryColor: HexColor
  warningColor:   HexColor
  criticalColor:  HexColor
  textColor:      HexColor
  fontSize:       number
}

/** Semantic version string — "MAJOR.MINOR.PATCH" */
export type SemVer = `${number}.${number}.${number}`

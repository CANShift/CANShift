export interface TopBarMetricsRatios {
  readonly dotRatio: number
  readonly fontSizeRatio: number
  readonly separatorRatio: number
  readonly gapRatio: number
  readonly paddingRatio: number
  readonly iconSizeRatio: number
  readonly labelFontPx: number
  readonly flagSquarePx: number
  readonly flagGapPx: number
}

export const TopBarMetrics: TopBarMetricsRatios = {
  dotRatio: 0.3,
  fontSizeRatio: 0.45,
  separatorRatio: 0.55,
  gapRatio: 0.25,
  paddingRatio: 0.4,
  iconSizeRatio: 1.15,
  labelFontPx: 10,
  flagSquarePx: 7,
  flagGapPx: 3,
} as const

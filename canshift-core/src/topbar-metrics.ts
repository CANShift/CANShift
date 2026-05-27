// topbar-metrics.ts — single source of truth for TopBar proportions
//
// Both renderers (Studio preview in canshift-studio-web/src/components/editor/Canvas.tsx
// and firmware top bar in canshift-firmware/src/ui/top_bar.cpp) derive every
// pixel from the bar height using these ratios. Keep both renderers in sync
// with this table — the firmware mirrors these constants in C++ at the top of
// top_bar.cpp.
//
// All ratios are relative to the TopBar height except `iconSizeRatio`, which
// is relative to the font size (icons should be slightly larger than text to
// stay visually balanced).

export interface TopBarMetricsRatios {
  /** Status-dot diameter (LEFT cluster ECU/CAN dots). */
  readonly dotRatio: number
  /** Label and signal font size. */
  readonly fontSizeRatio: number
  /** Vertical separator height (the "|" glyph). */
  readonly separatorRatio: number
  /** Gap between adjacent items inside a position bucket. */
  readonly gapRatio: number
  /** Horizontal padding from bar edge to outermost item. */
  readonly paddingRatio: number
  /** Icon size — relative to the font size, NOT the bar height. */
  readonly iconSizeRatio: number
}

/**
 * TopBar proportion table. Studio preview reads these directly; firmware
 * mirrors the same numbers in C++ (top_bar.cpp). A unit test pins the values
 * so any drift between TS and C++ is caught on the TS side at least.
 */
export const TopBarMetrics: TopBarMetricsRatios = {
  dotRatio: 0.3,
  fontSizeRatio: 0.45,
  separatorRatio: 0.55,
  gapRatio: 0.25,
  paddingRatio: 0.4,
  iconSizeRatio: 1.15,
} as const

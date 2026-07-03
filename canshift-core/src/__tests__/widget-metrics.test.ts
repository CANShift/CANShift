import {
  WIDGET_ZONE_COLORS,
  WIDGET_TEXT_COLORS,
  WIDGET_STALE_TEXT_COLORS,
  widgetTextColor,
  widgetStaleTextColor,
  WIDGET_FONT_CLAMP,
  VALUE_FRAC_FONT_RATIO,
  VALUE_UNIT_FONT_SIZE,
  STALE_PLACEHOLDER,
  widgetFracFontSize,
  GAUGE_ARC,
  GAUGE_TRACK_COLORS,
  gaugeValueFontSize,
  gaugeArcStrokeWidth,
  gaugeValueAngle,
  gaugeGradientColorAt,
  labelFontSize,
  gearFontSize,
  gearGlyph,
  GEAR_NEUTRAL_GLYPH,
  GEAR_REVERSE_GLYPH,
  WARNING_BLINK_PERIOD_MS,
  WARNING_BLINK_OPACITY,
  WARNING_IDLE_BG_OPACITY,
  WARNING_STALE_BORDER_WIDTH,
  WARNING_SIGNAL_LABEL_MIN_HEIGHT,
  isWarningTripped,
  TIMER_LONG_PRESS_MS,
  TIMER_BLINK_PERIOD_MS,
  TIMER_STATE_BORDER_WIDTH,
  TIMER_BORDER_COLORS,
  timerFontSize,
  formatTimerMmSs,
  formatTimerSsMmm,
  SENSOR_DEFAULT_RANGES,
  sensorDefaultRange,
} from '../widget-metrics.js'
import { SENSOR_DEFAULT_RAMPS, SENSOR_KINDS } from '../sensor-defaults.js'
import type { SensorKind } from '../sensor-defaults.js'
import { HEX_REGEX } from '../colors/hex.js'

describe('WIDGET_ZONE_COLORS', () => {
  it('pins widget_helpers.h kZoneNormalRgb = 0x00CC44', () => {
    expect(WIDGET_ZONE_COLORS.normal).toBe('#00CC44')
  })
  it('pins widget_helpers.h kZoneWarningRgb = 0xFF8800', () => {
    expect(WIDGET_ZONE_COLORS.warning).toBe('#FF8800')
  })
  it('pins widget_helpers.h kZoneDangerRgb = 0xFF4444', () => {
    expect(WIDGET_ZONE_COLORS.danger).toBe('#FF4444')
  })
})

describe('theme text colors', () => {
  it('pins theme_manager.cpp getEffectiveTextColor night 0xFFFFFF / day 0x000000', () => {
    expect(WIDGET_TEXT_COLORS.night).toBe('#FFFFFF')
    expect(WIDGET_TEXT_COLORS.day).toBe('#000000')
    expect(widgetTextColor(true)).toBe('#000000')
    expect(widgetTextColor(false)).toBe('#FFFFFF')
  })
  it('pins theme_manager.cpp STALE_TEXT night 0x555555 / day 0x888888', () => {
    expect(WIDGET_STALE_TEXT_COLORS.night).toBe('#555555')
    expect(WIDGET_STALE_TEXT_COLORS.day).toBe('#888888')
    expect(widgetStaleTextColor(true)).toBe('#888888')
    expect(widgetStaleTextColor(false)).toBe('#555555')
  })
})

describe('shared value-cluster rules', () => {
  it('pins gauge_widget.cpp / label_widget.cpp font clamp 12..48', () => {
    expect(WIDGET_FONT_CLAMP).toEqual({ min: 12, max: 48 })
  })
  it('pins int/frac split at 70% and 12px unit font', () => {
    expect(VALUE_FRAC_FONT_RATIO).toBe(0.7)
    expect(VALUE_UNIT_FONT_SIZE).toBe(12)
  })
  it('pins the stale placeholder "--"', () => {
    expect(STALE_PLACEHOLDER).toBe('--')
  })
  it('widgetFracFontSize: (int*7/10) floored, clamped to 12 (buildFracLabel)', () => {
    expect(widgetFracFontSize(48)).toBe(33)
    expect(widgetFracFontSize(32)).toBe(22)
    expect(widgetFracFontSize(20)).toBe(14)
    expect(widgetFracFontSize(15)).toBe(12)
  })
})

describe('gauge geometry', () => {
  it('pins gauge_widget.cpp arc sweep 270 / rotation 135', () => {
    expect(GAUGE_ARC.sweepDeg).toBe(270)
    expect(GAUGE_ARC.rotationDeg).toBe(135)
  })
  it('pins computeArcStrokeWidth ratios min(w*0.48,h*0.49)*0.30 floor 5', () => {
    expect(GAUGE_ARC.strokeRatio).toBe(0.3)
    expect(GAUGE_ARC.strokeWidthRatioW).toBe(0.48)
    expect(GAUGE_ARC.strokeWidthRatioH).toBe(0.49)
    expect(GAUGE_ARC.strokeWidthFloor).toBe(5)
  })
  it('pins kMinArcDiam 40 / padding 4 / yShift 2', () => {
    expect(GAUGE_ARC.minDiameter).toBe(40)
    expect(GAUGE_ARC.containerPadding).toBe(4)
    expect(GAUGE_ARC.yShift).toBe(2)
  })
  it('pins kColorBgDim 0x222222 / kColorGradientBg 0x2A2A2A', () => {
    expect(GAUGE_TRACK_COLORS.plain).toBe('#222222')
    expect(GAUGE_TRACK_COLORS.gradient).toBe('#2A2A2A')
  })

  it('gaugeValueFontSize matches resolveValueFont breakpoints 48/32/24/20', () => {
    expect(gaugeValueFontSize(165)).toBe(48)
    expect(gaugeValueFontSize(200)).toBe(48)
    expect(gaugeValueFontSize(164)).toBe(32)
    expect(gaugeValueFontSize(125)).toBe(32)
    expect(gaugeValueFontSize(124)).toBe(24)
    expect(gaugeValueFontSize(95)).toBe(24)
    expect(gaugeValueFontSize(94)).toBe(20)
    expect(gaugeValueFontSize(0)).toBe(20)
  })

  it('gaugeArcStrokeWidth = min(w*0.48,h*0.49)*0.30 with a floor of 5', () => {
    expect(gaugeArcStrokeWidth(100, 100)).toBeCloseTo(14.4, 5)

    expect(gaugeArcStrokeWidth(20, 20)).toBe(5)
  })

  it('gaugeValueAngle spans 0..270 across the range and clamps', () => {
    expect(gaugeValueAngle(0, 0, 100)).toBe(0)
    expect(gaugeValueAngle(50, 0, 100)).toBe(135)
    expect(gaugeValueAngle(100, 0, 100)).toBe(270)
    expect(gaugeValueAngle(150, 0, 100)).toBe(270)
    expect(gaugeValueAngle(-50, 0, 100)).toBe(0)
    expect(gaugeValueAngle(5, 5, 5)).toBe(0)
  })

  it('gaugeGradientColorAt interpolates green -> orange -> red (zone palette)', () => {
    expect(gaugeGradientColorAt(0)).toBe(WIDGET_ZONE_COLORS.normal)
    expect(gaugeGradientColorAt(0.5)).toBe(WIDGET_ZONE_COLORS.warning)
    expect(gaugeGradientColorAt(1)).toBe(WIDGET_ZONE_COLORS.danger)
    expect(gaugeGradientColorAt(-1)).toBe(WIDGET_ZONE_COLORS.normal)
    expect(gaugeGradientColorAt(2)).toBe(WIDGET_ZONE_COLORS.danger)
    expect(HEX_REGEX.test(gaugeGradientColorAt(0.25))).toBe(true)
  })
})

describe('labelFontSize (label_widget.cpp pickValueFontSize)', () => {
  it('= min(trunc(h*65/100), trunc(w*52/100))', () => {
    expect(labelFontSize(100, 100)).toBe(48)

    expect(labelFontSize(60, 50)).toBe(31)
  })
  it('clamps to 12..48 at the boundaries', () => {
    expect(labelFontSize(10, 10)).toBe(12)
    expect(labelFontSize(1000, 1000)).toBe(48)
  })
})

describe('gearFontSize (gear_widget.cpp selectFont)', () => {
  it('= min(trunc(h*85/100), trunc(w*72/100))', () => {
    expect(gearFontSize(40, 40)).toBe(28)
  })
  it('clamps to 12..48 at the boundaries', () => {
    expect(gearFontSize(10, 10)).toBe(12)
    expect(gearFontSize(1000, 1000)).toBe(48)
  })
})

describe('gearGlyph (gear_widget.cpp update)', () => {
  it('0 -> N, <0 -> R, >0 -> number', () => {
    expect(gearGlyph(0)).toBe(GEAR_NEUTRAL_GLYPH)
    expect(gearGlyph(0)).toBe('N')
    expect(gearGlyph(-1)).toBe(GEAR_REVERSE_GLYPH)
    expect(gearGlyph(-3)).toBe('R')
    expect(gearGlyph(1)).toBe('1')
    expect(gearGlyph(6)).toBe('6')
  })
})

describe('warning widget (warning_widget.cpp)', () => {
  it('pins BLINK_PERIOD_MS 1000 and opacity 0x00..0xCC', () => {
    expect(WARNING_BLINK_PERIOD_MS).toBe(1000)
    expect(WARNING_BLINK_OPACITY).toEqual({ min: 0x00, max: 0xcc })
  })
  it('pins IDLE_BG_OPA 0x18, stale border 1, signal-label min height 28', () => {
    expect(WARNING_IDLE_BG_OPACITY).toBe(0x18)
    expect(WARNING_STALE_BORDER_WIDTH).toBe(1)
    expect(WARNING_SIGNAL_LABEL_MIN_HEIGHT).toBe(28)
  })
  it('isWarningTripped: value>=threshold, inverted value<threshold', () => {
    expect(isWarningTripped(10, 5, false)).toBe(true)
    expect(isWarningTripped(5, 5, false)).toBe(true)
    expect(isWarningTripped(4, 5, false)).toBe(false)
    expect(isWarningTripped(4, 5, true)).toBe(true)
    expect(isWarningTripped(5, 5, true)).toBe(false)
  })
})

describe('timer widget (timer_widget.cpp)', () => {
  it('pins LONG_PRESS_MS 600, BLINK_PERIOD_MS 1000, border width 2', () => {
    expect(TIMER_LONG_PRESS_MS).toBe(600)
    expect(TIMER_BLINK_PERIOD_MS).toBe(1000)
    expect(TIMER_STATE_BORDER_WIDTH).toBe(2)
  })
  it('pins running=zone normal / paused=zone warning borders', () => {
    expect(TIMER_BORDER_COLORS.running).toBe(WIDGET_ZONE_COLORS.normal)
    expect(TIMER_BORDER_COLORS.paused).toBe(WIDGET_ZONE_COLORS.warning)
  })
  it('timerFontSize matches breakpoints 32/24/20', () => {
    expect(timerFontSize(110)).toBe(32)
    expect(timerFontSize(109)).toBe(24)
    expect(timerFontSize(80)).toBe(24)
    expect(timerFontSize(79)).toBe(20)
    expect(timerFontSize(0)).toBe(20)
  })
  it('formatTimerMmSs: MM:SS with blinkable colon', () => {
    expect(formatTimerMmSs(0, true)).toBe('00:00')
    expect(formatTimerMmSs(65_000, true)).toBe('01:05')
    expect(formatTimerMmSs(65_000, false)).toBe('01 05')
    expect(formatTimerMmSs(600_000, true)).toBe('10:00')
  })
  it('formatTimerSsMmm: SS.mmm', () => {
    expect(formatTimerSsMmm(0)).toBe('00.000')
    expect(formatTimerSsMmm(1_234)).toBe('01.234')
    expect(formatTimerSsMmm(59_999)).toBe('59.999')
  })
})

describe('SENSOR_DEFAULT_RANGES', () => {
  it('covers every SensorKind', () => {
    expect(Object.keys(SENSOR_DEFAULT_RANGES).sort()).toEqual([...SENSOR_KINDS].sort())
  })

  const entries = Object.entries(SENSOR_DEFAULT_RANGES) as [
    SensorKind,
    { min: number; max: number },
  ][]

  it.each(entries)('%s: min < max and covers its ramp stops', (kind, range) => {
    expect(range.min).toBeLessThan(range.max)
    const stops = SENSOR_DEFAULT_RAMPS[kind].stops
    const first = stops[0]!.value
    const last = stops[stops.length - 1]!.value
    expect(range.min).toBeLessThanOrEqual(first)
    expect(range.max).toBeGreaterThanOrEqual(last)
  })

  it('sensorDefaultRange resolves the same record entry', () => {
    for (const kind of SENSOR_KINDS) {
      expect(sensorDefaultRange(kind)).toBe(SENSOR_DEFAULT_RANGES[kind])
    }
  })
})

import {
  WIDGET_TEXT_COLORS,
  WIDGET_STALE_TEXT_COLORS,
  WIDGET_ZONE_COLORS,
} from '@tmbk/canshift-core'
import {
  formatWidgetValue,
  gaugeFillFraction,
  gearColor,
  gearGlyphFor,
  splitWidgetValue,
  warningState,
} from '../widget-value'
import { signalKeyToSensorKind } from '../../../theme/signal-colors'

describe('formatWidgetValue', () => {
  it('rounds to an integer when decimals is zero', () => {
    expect(formatWidgetValue(94.6, 0)).toBe('95')
    expect(formatWidgetValue(-4.6, 0)).toBe('-5')
  })

  it('fixes to the requested decimals', () => {
    expect(formatWidgetValue(1.234, 2)).toBe('1.23')
    expect(formatWidgetValue(8, 1)).toBe('8.0')
  })
})

describe('splitWidgetValue', () => {
  it('splits on the decimal point, keeping the dot with the fraction', () => {
    expect(splitWidgetValue('1.05', true)).toEqual({ int: '1', frac: '.05' })
    expect(splitWidgetValue('12.3', false)).toEqual({ int: '12', frac: '.3' })
  })

  it('splits the trailing thousands group when requested', () => {
    expect(splitWidgetValue('8000', true)).toEqual({ int: '8', frac: '000' })
    expect(splitWidgetValue('-1500', true)).toEqual({ int: '-1', frac: '500' })
  })

  it('keeps the whole integer when thousands split is disabled', () => {
    expect(splitWidgetValue('8000', false)).toEqual({ int: '8000', frac: '' })
    expect(splitWidgetValue('95', false)).toEqual({ int: '95', frac: '' })
  })

  it('leaves short integers unsplit even when requested', () => {
    expect(splitWidgetValue('95', true)).toEqual({ int: '95', frac: '' })
  })
})

describe('gaugeFillFraction', () => {
  it('maps a mid-range value to half fill', () => {
    expect(gaugeFillFraction(60, 0, 120)).toBeCloseTo(0.5)
  })

  it('clamps values above and below the range', () => {
    expect(gaugeFillFraction(200, 0, 120)).toBe(1)
    expect(gaugeFillFraction(-50, 0, 120)).toBe(0)
  })

  it('returns zero for a degenerate range', () => {
    expect(gaugeFillFraction(50, 100, 100)).toBe(0)
  })
})

describe('signalKeyToSensorKind', () => {
  it('resolves mapped sensor signals', () => {
    expect(signalKeyToSensorKind('r')).toBe('rpm')
    expect(signalKeyToSensorKind('ct')).toBe('coolant_temp')
    expect(signalKeyToSensorKind('bst')).toBe('boost')
  })

  it('returns undefined for signals without a sensor kind', () => {
    expect(signalKeyToSensorKind('s')).toBeUndefined()
    expect(signalKeyToSensorKind('g')).toBeUndefined()
    expect(signalKeyToSensorKind('tps')).toBeUndefined()
  })
})

describe('gearGlyphFor', () => {
  it('maps neutral, reverse and forward gears', () => {
    expect(gearGlyphFor(0)).toBe('N')
    expect(gearGlyphFor(-1)).toBe('R')
    expect(gearGlyphFor(3)).toBe('3')
    expect(gearGlyphFor(3.9)).toBe('3')
  })

  it('shows the neutral glyph when stale', () => {
    expect(gearGlyphFor(undefined)).toBe('N')
  })
})

describe('gearColor', () => {
  it('uses stale text color when the value is missing', () => {
    expect(gearColor(undefined, false)).toBe(WIDGET_STALE_TEXT_COLORS.night)
    expect(gearColor(undefined, true)).toBe(WIDGET_STALE_TEXT_COLORS.day)
  })

  it('paints reverse in the warning color', () => {
    expect(gearColor(-1, false)).toBe(WIDGET_ZONE_COLORS.warning)
  })

  it('paints neutral and forward gears in the text color', () => {
    expect(gearColor(0, false)).toBe(WIDGET_TEXT_COLORS.night)
    expect(gearColor(4, true)).toBe(WIDGET_TEXT_COLORS.day)
  })
})

describe('warningState', () => {
  it('is stale when the value is missing', () => {
    expect(warningState(undefined, 110, false)).toBe('stale')
  })

  it('alarms at or above a high-side threshold', () => {
    expect(warningState(115, 110, false)).toBe('alarm')
    expect(warningState(110, 110, false)).toBe('alarm')
    expect(warningState(95, 110, false)).toBe('idle')
  })

  it('alarms below an inverted low-side threshold', () => {
    expect(warningState(0.8, 1.0, true)).toBe('alarm')
    expect(warningState(1.0, 1.0, true)).toBe('idle')
    expect(warningState(2.5, 1.0, true)).toBe('idle')
  })
})

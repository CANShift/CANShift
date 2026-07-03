import { formatWidgetValue, gaugeFillFraction, splitWidgetValue } from '../widget-value'
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

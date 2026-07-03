import * as React from 'react'
import { render } from '@testing-library/react-native'
import { STALE_PLACEHOLDER } from '@tmbk/canshift-core'
import GaugeWidget from '../GaugeWidget'
import LabelWidget from '../LabelWidget'
import GearWidget from '../GearWidget'
import WarningWidget from '../WarningWidget'

describe('GaugeWidget', () => {
  it('renders an arc gauge for a sensor-backed signal', () => {
    const { getByText, toJSON } = render(<GaugeWidget signalKey="r" value={4000} size={140} />)
    expect(getByText('4')).toBeTruthy()
    expect(toJSON()).toBeTruthy()
  })

  it('renders the stale placeholder when the value is undefined', () => {
    const { getByText } = render(<GaugeWidget signalKey="ct" value={undefined} size={120} />)
    expect(getByText(STALE_PLACEHOLDER)).toBeTruthy()
  })

  it('falls back to a plain value for signals without a sensor kind', () => {
    const { getByText, queryByText } = render(<GaugeWidget signalKey="s" value={88} size={120} />)
    expect(getByText('88')).toBeTruthy()
    expect(queryByText(STALE_PLACEHOLDER)).toBeNull()
  })
})

describe('LabelWidget', () => {
  it('renders the label header, value and unit', () => {
    const { getByText } = render(<LabelWidget signalKey="ct" value={92} width={140} height={88} />)
    expect(getByText('COOLANT')).toBeTruthy()
    expect(getByText('92')).toBeTruthy()
    expect(getByText('°C')).toBeTruthy()
  })

  it('renders the stale placeholder when the value is undefined', () => {
    const { getByText } = render(
      <LabelWidget signalKey="op" value={undefined} width={140} height={88} />
    )
    expect(getByText(STALE_PLACEHOLDER)).toBeTruthy()
  })
})

describe('GearWidget', () => {
  it('renders the gear number for a forward gear', () => {
    const { getByText } = render(<GearWidget signalKey="g" value={3} size={120} />)
    expect(getByText('3')).toBeTruthy()
  })

  it('renders N for neutral and R for reverse', () => {
    expect(render(<GearWidget signalKey="g" value={0} size={120} />).getByText('N')).toBeTruthy()
    expect(render(<GearWidget signalKey="g" value={-1} size={120} />).getByText('R')).toBeTruthy()
  })

  it('renders the neutral glyph when the value is undefined', () => {
    const { getByText } = render(<GearWidget signalKey="g" value={undefined} size={120} />)
    expect(getByText('N')).toBeTruthy()
  })
})

describe('WarningWidget', () => {
  it('flags an alarm as an alert live region when tripped', () => {
    const { getByLabelText } = render(<WarningWidget signalKey="ct" value={130} size={48} />)
    const alert = getByLabelText('Coolant warning') as unknown as {
      props: { accessibilityRole?: string; accessibilityLiveRegion?: string }
    }
    expect(alert.props.accessibilityRole).toBe('alert')
    expect(alert.props.accessibilityLiveRegion).toBe('assertive')
  })

  it('renders an unobtrusive idle state below the danger threshold', () => {
    const { getByLabelText } = render(<WarningWidget signalKey="ct" value={80} size={48} />)
    expect(getByLabelText('Coolant normal')).toBeTruthy()
  })

  it('renders a stale state when the value is undefined', () => {
    const { getByLabelText } = render(<WarningWidget signalKey="op" value={undefined} size={48} />)
    expect(getByLabelText('Oil Pressure stale')).toBeTruthy()
  })

  it('renders nothing for a signal without a sensor kind', () => {
    const { toJSON } = render(<WarningWidget signalKey="s" value={100} size={48} />)
    expect(toJSON()).toBeNull()
  })
})

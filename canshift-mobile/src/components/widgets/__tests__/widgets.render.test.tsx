import * as React from 'react'
import { render } from '@testing-library/react-native'
import { STALE_PLACEHOLDER } from '@tmbk/canshift-core'
import GaugeWidget from '../GaugeWidget'
import LabelWidget from '../LabelWidget'

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

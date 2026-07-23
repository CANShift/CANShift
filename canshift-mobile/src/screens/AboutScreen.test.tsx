import * as React from 'react'
import { render } from '@testing-library/react-native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import AboutScreen from './AboutScreen'
import { useDeviceStore } from '../stores/device.store'
import type { RootStackParamList } from '../navigation'

jest.mock('../lib/expo-version', () => ({
  readAppVersion: () => '1.2.3',
}))

jest.mock('@tmbk/canshift-core', () => ({
  ...jest.requireActual<typeof import('@tmbk/canshift-core')>('@tmbk/canshift-core'),
  CURRENT_SCHEMA_VERSION: '1.24.0',
}))

const navigation = {
  goBack: jest.fn(),
} as unknown as NativeStackNavigationProp<RootStackParamList, 'About'>

const renderScreen = () => render(<AboutScreen navigation={navigation} />)

describe('AboutScreen', () => {
  beforeEach(() => {
    useDeviceStore.getState().disconnect()
  })

  it('shows the mobile app version', () => {
    const { getByText } = renderScreen()
    expect(getByText('v1.2.3')).toBeTruthy()
  })

  it('shows disconnected state for the dashboard rows when not connected', () => {
    const { getByText, getAllByText } = renderScreen()
    expect(getByText('Disconnected')).toBeTruthy()
    expect(getAllByText('Not connected').length).toBeGreaterThanOrEqual(2)
  })

  it('shows the connection label and firmware version when connected', () => {
    useDeviceStore.setState({
      connectionState: 'connected',
      firmwareVersion: '2.0.1',
      deviceName: 'CANShift-01',
      deviceId: 'AA:BB:CC',
    })
    const { getByText } = renderScreen()
    expect(getByText('Connected')).toBeTruthy()
    expect(getByText('v2.0.1')).toBeTruthy()
    expect(getByText('CANShift-01')).toBeTruthy()
    expect(getByText('AA:BB:CC')).toBeTruthy()
  })
})

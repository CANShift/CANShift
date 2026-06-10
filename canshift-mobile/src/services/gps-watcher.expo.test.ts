import * as Location from 'expo-location'
import type { GpsWatcherUpdate } from './gps-subscription'
import { expoLocationWatcher, requestForegroundLocationPermission } from './gps-watcher.expo'

jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
  watchPositionAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
}))

const mockedWatch = Location.watchPositionAsync as jest.MockedFunction<
  typeof Location.watchPositionAsync
>
const mockedRequest = Location.requestForegroundPermissionsAsync as jest.MockedFunction<
  typeof Location.requestForegroundPermissionsAsync
>

const buildLocation = (
  overrides: Partial<Location.LocationObjectCoords> = {}
): Location.LocationObject => ({
  timestamp: 1700,
  coords: {
    latitude: 46.2,
    longitude: 6.1,
    altitude: null,
    accuracy: 5,
    altitudeAccuracy: null,
    heading: 180,
    speed: 12.5,
    ...overrides,
  },
  mocked: false,
})

describe('requestForegroundLocationPermission', () => {
  beforeEach(() => {
    mockedRequest.mockReset()
  })

  it('returns granted=true when the OS grants the permission', async () => {
    mockedRequest.mockResolvedValueOnce({
      status: Location.PermissionStatus.GRANTED,
      granted: true,
      expires: 'never',
      canAskAgain: true,
    })
    await expect(requestForegroundLocationPermission()).resolves.toEqual({ granted: true })
  })

  it('returns granted=false with canAskAgain when the user denied but can be re-prompted', async () => {
    mockedRequest.mockResolvedValueOnce({
      status: Location.PermissionStatus.DENIED,
      granted: false,
      expires: 'never',
      canAskAgain: true,
    })
    await expect(requestForegroundLocationPermission()).resolves.toEqual({
      granted: false,
      canAskAgain: true,
    })
  })

  it('returns granted=false + canAskAgain=false when the user permanently denied', async () => {
    mockedRequest.mockResolvedValueOnce({
      status: Location.PermissionStatus.DENIED,
      granted: false,
      expires: 'never',
      canAskAgain: false,
    })
    await expect(requestForegroundLocationPermission()).resolves.toEqual({
      granted: false,
      canAskAgain: false,
    })
  })
})

describe('expoLocationWatcher', () => {
  beforeEach(() => {
    mockedWatch.mockReset()
  })

  it('registers a watcher with high accuracy and the configured intervals', async () => {
    mockedWatch.mockResolvedValueOnce({ remove: jest.fn() })
    await expoLocationWatcher.start(() => undefined)

    expect(mockedWatch).toHaveBeenCalledTimes(1)
    const [options] = mockedWatch.mock.calls[0] ?? []
    expect(options).toMatchObject({
      accuracy: Location.Accuracy.High,
      timeInterval: 200,
      distanceInterval: 1,
    })
  })

  it('converts each LocationObject to the GpsWatcherUpdate shape', async () => {
    let emit: (loc: Location.LocationObject) => void = () => undefined
    mockedWatch.mockImplementationOnce((_options, callback) => {
      emit = callback
      return Promise.resolve({ remove: jest.fn() })
    })

    const updates: GpsWatcherUpdate[] = []
    await expoLocationWatcher.start((u) => updates.push(u))

    emit(buildLocation())
    expect(updates).toEqual([{ t: 1700, lat: 46.2, lng: 6.1, speedMs: 12.5, headingDeg: 180 }])
  })

  it('passes through null speed and heading verbatim — the subscription layer normalises', async () => {
    let emit: (loc: Location.LocationObject) => void = () => undefined
    mockedWatch.mockImplementationOnce((_options, callback) => {
      emit = callback
      return Promise.resolve({ remove: jest.fn() })
    })

    const updates: GpsWatcherUpdate[] = []
    await expoLocationWatcher.start((u) => updates.push(u))

    emit(buildLocation({ speed: null, heading: null }))
    expect(updates[0]).toMatchObject({ speedMs: null, headingDeg: null })
  })

  it('returns a detacher that calls subscription.remove() exactly once', async () => {
    const remove = jest.fn()
    mockedWatch.mockResolvedValueOnce({ remove })
    const detach = await expoLocationWatcher.start(() => undefined)

    detach()
    detach()
    expect(remove).toHaveBeenCalledTimes(2)
  })
})

import { renderHook, act } from '@testing-library/react-native'

const mockIsFocused = jest.fn<boolean, []>()
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockIsFocused(),
}))

import { useGraphTick } from './use-graph-tick'

beforeEach(() => {
  jest.useFakeTimers()
  mockIsFocused.mockReturnValue(true)
})

afterEach(() => {
  jest.useRealTimers()
  mockIsFocused.mockReset()
})

describe('useGraphTick — explicit paused flag', () => {
  it('bumps the counter every 100 ms while running', () => {
    const { result } = renderHook(({ paused }: { paused: boolean }) => useGraphTick(paused), {
      initialProps: { paused: false },
    })
    expect(result.current).toBe(0)
    act(() => {
      jest.advanceTimersByTime(300)
    })
    expect(result.current).toBe(3)
  })

  it('freezes when paused flips to true', () => {
    const { result, rerender } = renderHook(
      ({ paused }: { paused: boolean }) => useGraphTick(paused),
      {
        initialProps: { paused: false },
      }
    )
    act(() => {
      jest.advanceTimersByTime(200)
    })
    expect(result.current).toBe(2)

    rerender({ paused: true })
    act(() => {
      jest.advanceTimersByTime(500)
    })
    expect(result.current).toBe(2)
  })

  it('resumes from the current value when paused flips back to false', () => {
    const { result, rerender } = renderHook(
      ({ paused }: { paused: boolean }) => useGraphTick(paused),
      {
        initialProps: { paused: false },
      }
    )
    act(() => {
      jest.advanceTimersByTime(200)
    })
    rerender({ paused: true })
    act(() => {
      jest.advanceTimersByTime(500)
    })
    rerender({ paused: false })
    act(() => {
      jest.advanceTimersByTime(100)
    })
    expect(result.current).toBe(3)
  })
})

describe('useGraphTick — screen focus (#1017 M-LO-6)', () => {
  it('does not tick while the screen is not focused', () => {
    mockIsFocused.mockReturnValue(false)
    const { result } = renderHook(({ paused }: { paused: boolean }) => useGraphTick(paused), {
      initialProps: { paused: false },
    })
    act(() => {
      jest.advanceTimersByTime(500)
    })
    expect(result.current).toBe(0)
  })

  it('resumes when the screen regains focus', () => {
    mockIsFocused.mockReturnValue(false)
    const { result, rerender } = renderHook(
      ({ paused }: { paused: boolean }) => useGraphTick(paused),
      {
        initialProps: { paused: false },
      }
    )
    act(() => {
      jest.advanceTimersByTime(500)
    })
    expect(result.current).toBe(0)

    mockIsFocused.mockReturnValue(true)
    rerender({ paused: false })
    act(() => {
      jest.advanceTimersByTime(200)
    })
    expect(result.current).toBe(2)
  })

  it('stays paused if both sources are paused (paused=true AND blurred)', () => {
    mockIsFocused.mockReturnValue(false)
    const { result } = renderHook(({ paused }: { paused: boolean }) => useGraphTick(paused), {
      initialProps: { paused: true },
    })
    act(() => {
      jest.advanceTimersByTime(500)
    })
    expect(result.current).toBe(0)
  })

  it('stays paused if `paused=true` even when focused', () => {
    mockIsFocused.mockReturnValue(true)
    const { result } = renderHook(({ paused }: { paused: boolean }) => useGraphTick(paused), {
      initialProps: { paused: true },
    })
    act(() => {
      jest.advanceTimersByTime(500)
    })
    expect(result.current).toBe(0)
  })
})

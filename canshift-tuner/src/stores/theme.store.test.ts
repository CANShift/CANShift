import { describe, it, expect } from 'vitest'
import { useThemeStore } from './theme.store'

describe('theme.store', () => {
  it('defaults to the dark theme outside the browser', () => {
    expect(useThemeStore.getState().theme).toBe('dark')
  })

  it('toggles between dark and light', () => {
    useThemeStore.getState().toggleTheme()
    expect(useThemeStore.getState().theme).toBe('light')
    useThemeStore.getState().toggleTheme()
    expect(useThemeStore.getState().theme).toBe('dark')
  })
})

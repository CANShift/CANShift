import * as React from 'react'
import { render } from '@testing-library/react-native'
import { Toaster, Toast } from '../toast'

describe('Toaster', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<Toaster />)
    expect(toJSON()).toBeTruthy()
  })

  it('exposes the imperative Toast handle with show/hide', () => {
    expect(typeof Toast.show).toBe('function')
    expect(typeof Toast.hide).toBe('function')
  })
})

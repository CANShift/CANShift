import * as React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { Button } from '../button'

describe('Button', () => {
  it('renders the text child', () => {
    const { getByText } = render(<Button>Save</Button>)
    expect(getByText('Save')).toBeTruthy()
  })

  it('fires onPress when pressed', () => {
    const onPress = jest.fn()
    const { getByRole } = render(<Button onPress={onPress}>Save</Button>)
    fireEvent.press(getByRole('button'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('does not fire onPress when disabled', () => {
    const onPress = jest.fn()
    const { getByRole } = render(<Button onPress={onPress} disabled>Save</Button>)
    fireEvent.press(getByRole('button'))
    expect(onPress).not.toHaveBeenCalled()
  })

  it('applies the destructive variant className', () => {
    const { getByRole } = render(<Button variant="destructive">Delete</Button>)
    const node = getByRole('button') as unknown as { props: { className?: string } }
    expect(node.props.className ?? '').toContain('bg-destructive')
  })

  it('reflects accessibilityState.disabled', () => {
    const { getByRole } = render(<Button disabled>Save</Button>)
    const node = getByRole('button') as unknown as {
      props: { accessibilityState?: { disabled?: boolean } }
    }
    expect(node.props.accessibilityState?.disabled).toBe(true)
  })
})

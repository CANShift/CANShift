import * as React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { Checkbox } from '../checkbox'

describe('Checkbox', () => {
  it('renders with the unchecked state', () => {
    const { getByRole } = render(
      <Checkbox checked={false} onCheckedChange={() => undefined} />,
    )
    const node = getByRole('checkbox') as unknown as {
      props: { accessibilityState?: { checked?: boolean } }
    }
    expect(node.props.accessibilityState?.checked).toBe(false)
  })

  it('fires onCheckedChange with the next value when pressed', () => {
    const onCheckedChange = jest.fn()
    const { getByRole } = render(
      <Checkbox checked={false} onCheckedChange={onCheckedChange} />,
    )
    fireEvent.press(getByRole('checkbox'))
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it('does not fire onCheckedChange when disabled', () => {
    const onCheckedChange = jest.fn()
    const { getByRole } = render(
      <Checkbox checked={false} onCheckedChange={onCheckedChange} disabled />,
    )
    fireEvent.press(getByRole('checkbox'))
    expect(onCheckedChange).not.toHaveBeenCalled()
  })
})

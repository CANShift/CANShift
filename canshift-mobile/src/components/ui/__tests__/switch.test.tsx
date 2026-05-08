import * as React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { Switch } from '../switch'

describe('Switch', () => {
  it('renders with value=false', () => {
    const { getByRole } = render(<Switch value={false} onValueChange={() => undefined} />)
    const node = getByRole('switch') as unknown as { props: { value?: boolean } }
    expect(node.props.value).toBe(false)
  })

  it('fires onValueChange when toggled', () => {
    const onValueChange = jest.fn()
    const { getByRole } = render(<Switch value={false} onValueChange={onValueChange} />)
    fireEvent(getByRole('switch'), 'valueChange', true)
    expect(onValueChange).toHaveBeenCalledWith(true)
  })
})

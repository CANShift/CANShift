import * as React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { Input } from '../input'

describe('Input', () => {
  it('renders the placeholder', () => {
    const { getByPlaceholderText } = render(
      <Input placeholder="Search" onChangeText={() => undefined} />,
    )
    expect(getByPlaceholderText('Search')).toBeTruthy()
  })

  it('forwards value and onChangeText', () => {
    const onChangeText = jest.fn()
    const { getByPlaceholderText } = render(
      <Input placeholder="Name" value="initial" onChangeText={onChangeText} />,
    )
    fireEvent.changeText(getByPlaceholderText('Name'), 'next')
    expect(onChangeText).toHaveBeenCalledWith('next')
  })

  it('applies the error variant className', () => {
    const { getByPlaceholderText } = render(
      <Input placeholder="X" variant="error" onChangeText={() => undefined} />,
    )
    const node = getByPlaceholderText('X') as unknown as { props: { className?: string } }
    expect(node.props.className ?? '').toContain('border-danger')
  })
})

import * as React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../select'

interface HarnessProps {
  defaultValue?: string
  onValueChange?: (next: string) => void
}

function Harness({ defaultValue, onValueChange }: HarnessProps): React.ReactElement {
  return (
    <Select
      {...(defaultValue !== undefined && { defaultValue })}
      {...(onValueChange !== undefined && { onValueChange })}
      placeholder="Pick one"
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="apple">Apple</SelectItem>
        <SelectItem value="banana">Banana</SelectItem>
      </SelectContent>
    </Select>
  )
}

describe('Select', () => {
  it('renders the trigger with placeholder and keeps options hidden', () => {
    const { getByText, queryByText } = render(<Harness />)
    expect(getByText('Pick one')).toBeTruthy()
    expect(queryByText('Apple')).toBeNull()
    expect(queryByText('Banana')).toBeNull()
  })

  it('opens the modal when the trigger is pressed', () => {
    const { getByRole, getByText } = render(<Harness />)
    fireEvent.press(getByRole('combobox'))
    expect(getByText('Apple')).toBeTruthy()
    expect(getByText('Banana')).toBeTruthy()
  })

  it('updates value and closes when an item is selected', () => {
    const onValueChange = jest.fn()
    const { getByRole, getByText, queryByText } = render(<Harness onValueChange={onValueChange} />)
    fireEvent.press(getByRole('combobox'))
    fireEvent.press(getByText('Banana'))
    expect(onValueChange).toHaveBeenCalledWith('banana')
    expect(queryByText('Apple')).toBeNull()
    expect(getByText('banana')).toBeTruthy()
  })
})

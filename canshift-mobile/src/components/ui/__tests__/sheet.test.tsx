import * as React from 'react'
import { Text } from 'react-native'
import { render, fireEvent } from '@testing-library/react-native'
import { Sheet, SheetContent, SheetClose, SheetTitle, SheetTrigger } from '../sheet'

interface HarnessProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (next: boolean) => void
}

const Harness = ({ open, defaultOpen, onOpenChange }: HarnessProps): React.ReactElement => {
  return (
    <Sheet
      {...(open !== undefined && { open })}
      {...(defaultOpen !== undefined && { defaultOpen })}
      {...(onOpenChange !== undefined && { onOpenChange })}
    >
      <SheetTrigger>
        <Text>Open</Text>
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetTitle>Hello</SheetTitle>
        <Text>Body content</Text>
        <SheetClose>
          <Text>Close</Text>
        </SheetClose>
      </SheetContent>
    </Sheet>
  )
}

describe('Sheet', () => {
  it('renders the trigger and hides content initially', () => {
    const { getByText, queryByText } = render(<Harness />)
    expect(getByText('Open')).toBeTruthy()
    expect(queryByText('Body content')).toBeNull()
  })

  it('opens the content when the trigger is pressed', () => {
    const { getByText } = render(<Harness />)
    fireEvent.press(getByText('Open'))
    expect(getByText('Body content')).toBeTruthy()
  })

  it('closes the content when the close button is pressed', () => {
    const { getByText, queryByText } = render(<Harness defaultOpen />)
    expect(getByText('Body content')).toBeTruthy()
    fireEvent.press(getByText('Close'))
    expect(queryByText('Body content')).toBeNull()
  })

  it('calls onOpenChange when controlled', () => {
    const onOpenChange = jest.fn()
    const { getByText } = render(<Harness open={false} onOpenChange={onOpenChange} />)
    fireEvent.press(getByText('Open'))
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })
})

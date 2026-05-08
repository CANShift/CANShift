import * as React from 'react'
import { Text } from 'react-native'
import { render, fireEvent } from '@testing-library/react-native'
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogTitle,
  DialogTrigger,
} from '../dialog'

interface HarnessProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (next: boolean) => void
}

function Harness({ open, defaultOpen, onOpenChange }: HarnessProps): React.ReactElement {
  return (
    <Dialog open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <DialogTrigger>
        <Text>Open</Text>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Hello</DialogTitle>
        <Text>Body content</Text>
        <DialogClose>
          <Text>Close</Text>
        </DialogClose>
      </DialogContent>
    </Dialog>
  )
}

describe('Dialog', () => {
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

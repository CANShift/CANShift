import * as React from 'react'
import { Text } from 'react-native'
import { render, fireEvent } from '@testing-library/react-native'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../tabs'

interface HarnessProps {
  defaultValue?: string
  onValueChange?: (next: string) => void
}

const Harness = ({ defaultValue, onValueChange }: HarnessProps): React.ReactElement => {
  return (
    <Tabs
      defaultValue={defaultValue ?? 'one'}
      {...(onValueChange !== undefined && { onValueChange })}
    >
      <TabsList>
        <TabsTrigger value="one">One</TabsTrigger>
        <TabsTrigger value="two">Two</TabsTrigger>
      </TabsList>
      <TabsContent value="one">
        <Text>Content one</Text>
      </TabsContent>
      <TabsContent value="two">
        <Text>Content two</Text>
      </TabsContent>
    </Tabs>
  )
}

describe('Tabs', () => {
  it('renders triggers and shows the default content', () => {
    const { getByText, queryByText } = render(<Harness />)
    expect(getByText('One')).toBeTruthy()
    expect(getByText('Two')).toBeTruthy()
    expect(getByText('Content one')).toBeTruthy()
    expect(queryByText('Content two')).toBeNull()
  })

  it('switches active tab on trigger press', () => {
    const onValueChange = jest.fn()
    const { getByText, queryByText } = render(<Harness onValueChange={onValueChange} />)
    fireEvent.press(getByText('Two'))
    expect(onValueChange).toHaveBeenCalledWith('two')
    expect(getByText('Content two')).toBeTruthy()
    expect(queryByText('Content one')).toBeNull()
  })

  it('renders content only for the matching value', () => {
    const { getByText, queryByText } = render(<Harness defaultValue="two" />)
    expect(getByText('Content two')).toBeTruthy()
    expect(queryByText('Content one')).toBeNull()
  })
})

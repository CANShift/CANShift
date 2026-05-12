import * as React from 'react'
import { Text } from 'react-native'
import { render } from '@testing-library/react-native'
import { Card, CardHeader, CardTitle, CardContent } from '../card'

describe('Card', () => {
  it('renders children', () => {
    const { getByText } = render(
      <Card>
        <Text>Hello</Text>
      </Card>
    )
    expect(getByText('Hello')).toBeTruthy()
  })

  it('renders the accent variant', () => {
    const { getByText } = render(
      <Card variant="accent">
        <Text>Accent</Text>
      </Card>
    )
    expect(getByText('Accent')).toBeTruthy()
  })

  it('composes Header + Title + Content', () => {
    const { getByText } = render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
        </CardHeader>
        <CardContent>
          <Text>Body</Text>
        </CardContent>
      </Card>
    )
    expect(getByText('Title')).toBeTruthy()
    expect(getByText('Body')).toBeTruthy()
  })
})

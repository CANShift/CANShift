import * as React from 'react'
import { render } from '@testing-library/react-native'
import { Label } from '../label'

describe('Label', () => {
  it('renders the text child', () => {
    const { getByText } = render(<Label>BRIGHTNESS</Label>)
    expect(getByText('BRIGHTNESS')).toBeTruthy()
  })

  it('applies muted text className', () => {
    const { getByText } = render(<Label>BRIGHTNESS</Label>)
    const node = getByText('BRIGHTNESS') as unknown as { props: { className?: string } }
    expect(node.props.className ?? '').toContain('text-text-muted')
  })
})

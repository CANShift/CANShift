import * as React from 'react'
import { Text } from 'react-native'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../form'
import { Input } from '../input'
import { Button } from '../button'

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
})

type FormValues = z.infer<typeof schema>

interface HarnessProps {
  onSubmit?: (values: FormValues) => void
  defaultName?: string
}

function Harness({ onSubmit, defaultName = '' }: HarnessProps): React.ReactElement {
  const methods = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: defaultName },
    mode: 'onSubmit',
  })

  const submit = methods.handleSubmit((values) => {
    onSubmit?.(values)
  })

  return (
    <Form {...methods}>
      <FormField
        control={methods.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="Enter name"
              />
            </FormControl>
            <FormDescription>Your display name.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <Button onPress={submit}>
        <Text>Submit</Text>
      </Button>
    </Form>
  )
}

describe('Form', () => {
  it('renders label, description, and control', () => {
    const { getByText, getByPlaceholderText } = render(<Harness />)
    expect(getByText('Name')).toBeTruthy()
    expect(getByText('Your display name.')).toBeTruthy()
    expect(getByPlaceholderText('Enter name')).toBeTruthy()
  })

  it('shows validation error from the resolver after submit', async () => {
    const onSubmit = jest.fn()
    const { getByText, queryByText } = render(<Harness onSubmit={onSubmit} />)

    expect(queryByText('Name must be at least 2 characters')).toBeNull()
    fireEvent.press(getByText('Submit'))

    await waitFor(() => {
      expect(getByText('Name must be at least 2 characters')).toBeTruthy()
    })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits valid values', async () => {
    const onSubmit = jest.fn()
    const { getByText, getByPlaceholderText } = render(
      <Harness onSubmit={onSubmit} defaultName="Alice" />
    )

    fireEvent.changeText(getByPlaceholderText('Enter name'), 'Alice')
    fireEvent.press(getByText('Submit'))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ name: 'Alice' })
    })
  })
})

// src/components/ui/form.tsx — RN-flavored Form primitive built on react-hook-form

import * as React from 'react'
import { Text, View, type TextProps, type ViewProps } from 'react-native'
import {
  Controller,
  FormProvider,
  useFormContext,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form'
import { cn } from '@/lib/utils'
import { Label, type LabelProps } from './label'

const Form = FormProvider

interface FormFieldContextValue {
  name: string
}

const FormFieldContext = React.createContext<FormFieldContextValue | null>(null)

interface FormItemContextValue {
  id: string
}

const FormItemContext = React.createContext<FormItemContextValue | null>(null)

function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(props: ControllerProps<TFieldValues, TName>): React.ReactElement {
  const contextValue = React.useMemo<FormFieldContextValue>(
    () => ({ name: props.name }),
    [props.name]
  )
  return (
    <FormFieldContext.Provider value={contextValue}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

interface UseFormFieldReturn {
  id: string
  name: string
  formItemId: string
  formDescriptionId: string
  formMessageId: string
  error: { message?: string } | undefined
  invalid: boolean
  isDirty: boolean
  isTouched: boolean
}

function useFormField(): UseFormFieldReturn {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)
  const formContext = useFormContext()

  if (fieldContext === null) {
    throw new Error('useFormField must be used within a <FormField>')
  }
  if (itemContext === null) {
    throw new Error('useFormField must be used within a <FormItem>')
  }

  const { getFieldState, formState } = formContext
  const fieldState = getFieldState(fieldContext.name, formState)
  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    error: fieldState.error
      ? {
          message:
            typeof fieldState.error.message === 'string' ? fieldState.error.message : undefined,
        }
      : undefined,
    invalid: fieldState.invalid,
    isDirty: fieldState.isDirty,
    isTouched: fieldState.isTouched,
  }
}

export interface FormItemProps extends ViewProps {
  className?: string
}

const FormItem = React.forwardRef<React.ElementRef<typeof View>, FormItemProps>(
  ({ className, ...props }, ref) => {
    const idValue = React.useId()
    const contextValue = React.useMemo<FormItemContextValue>(() => ({ id: idValue }), [idValue])
    return (
      <FormItemContext.Provider value={contextValue}>
        <View ref={ref} className={cn('gap-2', className)} {...props} />
      </FormItemContext.Provider>
    )
  }
)
FormItem.displayName = 'FormItem'

export type FormLabelProps = LabelProps

const FormLabel = React.forwardRef<React.ElementRef<typeof Text>, FormLabelProps>(
  ({ className, ...props }, ref) => {
    const { error } = useFormField()
    return (
      <Label ref={ref} className={cn(error !== undefined && 'text-danger', className)} {...props} />
    )
  }
)
FormLabel.displayName = 'FormLabel'

export interface FormControlProps extends ViewProps {
  className?: string
}

const FormControl = React.forwardRef<React.ElementRef<typeof View>, FormControlProps>(
  ({ className, ...props }, ref) => <View ref={ref} className={cn(className)} {...props} />
)
FormControl.displayName = 'FormControl'

export interface FormDescriptionProps extends TextProps {
  className?: string
}

const FormDescription = React.forwardRef<React.ElementRef<typeof Text>, FormDescriptionProps>(
  ({ className, ...props }, ref) => (
    <Text ref={ref} className={cn('text-sm text-text-muted', className)} {...props} />
  )
)
FormDescription.displayName = 'FormDescription'

export interface FormMessageProps extends TextProps {
  className?: string
}

const FormMessage = React.forwardRef<React.ElementRef<typeof Text>, FormMessageProps>(
  ({ className, children, ...props }, ref) => {
    const { error } = useFormField()
    const body = error?.message ?? children
    if (body === undefined || body === null || body === false || body === '') {
      return null
    }
    return (
      <Text ref={ref} className={cn('text-sm text-danger', className)} {...props}>
        {body}
      </Text>
    )
  }
)
FormMessage.displayName = 'FormMessage'

export {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  useFormField,
}

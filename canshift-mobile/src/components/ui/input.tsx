import * as React from 'react'
import { TextInput, type TextInputProps } from 'react-native'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { Colors } from '@/theme'

const inputVariants = cva(
  'h-12 rounded-md border bg-surface px-3 text-base text-text',
  {
    variants: {
      variant: {
        default: 'border-border',
        error: 'border-danger',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

type InputVariantProps = VariantProps<typeof inputVariants>

export interface InputProps
  extends Omit<TextInputProps, 'style'>,
    InputVariantProps {
  className?: string
}

export const Input = React.forwardRef<React.ElementRef<typeof TextInput>, InputProps>(
  ({ className, variant, placeholderTextColor, ...props }, ref) => (
    <TextInput
      ref={ref}
      placeholderTextColor={placeholderTextColor ?? Colors.textMuted}
      className={cn(inputVariants({ variant }), className)}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export { inputVariants }

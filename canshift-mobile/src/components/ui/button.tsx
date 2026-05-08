import * as React from 'react'
import { Pressable, Text, type PressableProps } from 'react-native'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'flex-row items-center justify-center rounded-md',
  {
    variants: {
      variant: {
        default: 'bg-primary',
        destructive: 'bg-destructive',
        outline: 'border border-border bg-transparent',
        secondary: 'bg-surface-2',
        ghost: 'bg-transparent',
        link: 'bg-transparent',
      },
      size: {
        default: 'h-12 px-4',
        sm: 'h-9 px-3',
        lg: 'h-14 px-6',
        icon: 'h-12 w-12',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

const buttonTextVariants = cva('text-md font-medium', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      destructive: 'text-destructive-foreground',
      outline: 'text-text',
      secondary: 'text-text',
      ghost: 'text-text',
      link: 'text-primary underline',
    },
    size: {
      default: 'text-base',
      sm: 'text-sm',
      lg: 'text-lg',
      icon: 'text-base',
    },
  },
  defaultVariants: { variant: 'default', size: 'default' },
})

type ButtonVariantProps = VariantProps<typeof buttonVariants>

export interface ButtonProps
  extends Omit<PressableProps, 'children' | 'style'>,
    ButtonVariantProps {
  children?: React.ReactNode
  className?: string
  textClassName?: string
}

export const Button = React.forwardRef<React.ElementRef<typeof Pressable>, ButtonProps>(
  ({ className, textClassName, variant, size, disabled, children, ...props }, ref) => {
    return (
      <Pressable
        ref={ref}
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled ?? false }}
        disabled={disabled}
        className={cn(
          buttonVariants({ variant, size }),
          disabled && 'opacity-50',
          className,
        )}
        {...props}
      >
        {({ pressed }) => (
          <>
            {typeof children === 'string' ? (
              <Text
                className={cn(
                  buttonTextVariants({ variant, size }),
                  pressed && 'opacity-80',
                  textClassName,
                )}
              >
                {children}
              </Text>
            ) : (
              children
            )}
          </>
        )}
      </Pressable>
    )
  },
)
Button.displayName = 'Button'

export { buttonVariants, buttonTextVariants }

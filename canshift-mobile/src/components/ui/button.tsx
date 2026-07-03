import * as React from 'react'
import { Pressable, Text, type PressableProps } from 'react-native'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { Colors } from '@/theme'

const buttonVariants = cva('flex-row items-center justify-center gap-2 rounded-md', {
  variants: {
    variant: {
      default: 'bg-primary',
      destructive: 'bg-destructive',
      outline: 'border border-border bg-transparent',
      secondary: 'bg-secondary',
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
})

const buttonTextVariants = cva('text-base font-medium', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      destructive: 'text-destructive-foreground',
      outline: 'text-text',
      secondary: 'text-secondary-foreground',
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

type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>['variant']>

const ICON_SIZE = 16

const iconColorByVariant: Record<ButtonVariant, string> = {
  default: Colors.primaryForeground,
  destructive: Colors.destructiveForeground,
  outline: Colors.text,
  secondary: Colors.secondaryForeground,
  ghost: Colors.text,
  link: Colors.primary,
}

type ButtonVariantProps = VariantProps<typeof buttonVariants>

export interface ButtonProps
  extends Omit<PressableProps, 'children' | 'style'>, ButtonVariantProps {
  children?: React.ReactNode
  className?: string
  textClassName?: string
  leftIcon?: React.ReactElement
  rightIcon?: React.ReactElement
}

const renderIcon = (
  icon: React.ReactElement | undefined,
  variant: ButtonVariant
): React.ReactElement | null => {
  if (icon === undefined) {
    return null
  }
  const props = icon.props as { size?: number; color?: string }
  return React.cloneElement(icon, {
    size: props.size ?? ICON_SIZE,
    color: props.color ?? iconColorByVariant[variant],
  } as Partial<typeof props>)
}

export const Button = React.forwardRef<React.ComponentRef<typeof Pressable>, ButtonProps>(
  (
    { className, textClassName, variant, size, disabled, children, leftIcon, rightIcon, ...props },
    ref
  ) => {
    const resolvedVariant: ButtonVariant = variant ?? 'default'
    return (
      <Pressable
        ref={ref}
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled ?? false }}
        disabled={disabled}
        className={cn(
          buttonVariants({ variant, size }),
          'active:opacity-80',
          disabled && 'opacity-50',
          className
        )}
        {...props}
      >
        {renderIcon(leftIcon, resolvedVariant)}
        {typeof children === 'string' ? (
          <Text className={cn(buttonTextVariants({ variant, size }), textClassName)}>
            {children}
          </Text>
        ) : (
          children
        )}
        {renderIcon(rightIcon, resolvedVariant)}
      </Pressable>
    )
  }
)
Button.displayName = 'Button'

export { buttonVariants, buttonTextVariants }

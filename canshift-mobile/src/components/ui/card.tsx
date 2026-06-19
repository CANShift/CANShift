import * as React from 'react'
import { Text, View, type TextProps, type ViewProps } from 'react-native'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const cardVariants = cva('border border-border bg-surface', {
  variants: {
    variant: {
      default: 'border-border bg-surface',
      accent: 'border-accent bg-surface',
      muted: 'border-border bg-surface-2',
    },
    radius: {
      sm: 'rounded-sm',
      md: 'rounded-md',
      lg: 'rounded-lg',
    },
    padding: {
      none: '',
      sm: 'p-2',
      md: 'p-3',
      lg: 'p-4',
    },
  },
  defaultVariants: { variant: 'default', radius: 'md', padding: 'md' },
})

type CardVariantProps = VariantProps<typeof cardVariants>

export interface CardProps extends ViewProps, CardVariantProps {
  className?: string
}

export const Card = React.forwardRef<React.ComponentRef<typeof View>, CardProps>(
  ({ className, variant, radius, padding, ...props }, ref) => (
    <View
      ref={ref}
      className={cn(cardVariants({ variant, radius, padding }), className)}
      {...props}
    />
  )
)
Card.displayName = 'Card'

export interface CardHeaderProps extends ViewProps {
  className?: string
}

export const CardHeader = React.forwardRef<React.ComponentRef<typeof View>, CardHeaderProps>(
  ({ className, ...props }, ref) => (
    <View ref={ref} className={cn('flex-row items-center justify-between', className)} {...props} />
  )
)
CardHeader.displayName = 'CardHeader'

export interface CardTitleProps extends TextProps {
  className?: string
}

export const CardTitle = React.forwardRef<React.ComponentRef<typeof Text>, CardTitleProps>(
  ({ className, ...props }, ref) => (
    <Text ref={ref} className={cn('text-base font-semibold text-text', className)} {...props} />
  )
)
CardTitle.displayName = 'CardTitle'

export interface CardContentProps extends ViewProps {
  className?: string
}

export const CardContent = React.forwardRef<React.ComponentRef<typeof View>, CardContentProps>(
  ({ className, ...props }, ref) => <View ref={ref} className={cn(className)} {...props} />
)
CardContent.displayName = 'CardContent'

export { cardVariants }

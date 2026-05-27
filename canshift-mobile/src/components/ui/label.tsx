import * as React from 'react'
import { Text, type TextProps } from 'react-native'
import { cn } from '@/lib/utils'

export interface LabelProps extends TextProps {
  className?: string
}

export const Label = React.forwardRef<React.ElementRef<typeof Text>, LabelProps>(
  ({ className, children, ...props }, ref) => (
    <Text
      ref={ref}
      accessibilityRole="text"
      className={cn('text-[11px] uppercase tracking-[0.8px] text-text-muted', className)}
      {...props}
    >
      {children}
    </Text>
  )
)
Label.displayName = 'Label'

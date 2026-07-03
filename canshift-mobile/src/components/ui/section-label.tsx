import * as React from 'react'
import { Text, type TextProps } from 'react-native'
import { cn } from '@/lib/utils'

export interface SectionLabelProps extends TextProps {
  className?: string
}

export const SectionLabel = React.forwardRef<React.ComponentRef<typeof Text>, SectionLabelProps>(
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
SectionLabel.displayName = 'SectionLabel'

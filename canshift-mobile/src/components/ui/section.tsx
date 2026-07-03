import * as React from 'react'
import { View, type ViewProps } from 'react-native'
import { cn } from '@/lib/utils'
import { SectionLabel } from './section-label'

export interface SectionProps extends ViewProps {
  title?: string
  className?: string
  children?: React.ReactNode
}

export const Section = React.forwardRef<React.ComponentRef<typeof View>, SectionProps>(
  ({ title, className, children, ...props }, ref) => (
    <View ref={ref} className={cn('gap-2', className)} {...props}>
      {title !== undefined ? <SectionLabel>{title}</SectionLabel> : null}
      {children}
    </View>
  )
)
Section.displayName = 'Section'

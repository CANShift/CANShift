// section.tsx — Vertical block: optional title (Label) + content with consistent gap

import * as React from 'react'
import { View, type ViewProps } from 'react-native'
import { cn } from '@/lib/utils'
import { Label } from './label'

export interface SectionProps extends ViewProps {
  /** Optional uppercase label rendered above the content. */
  title?: string
  className?: string
  children?: React.ReactNode
}

export const Section = React.forwardRef<React.ComponentRef<typeof View>, SectionProps>(
  ({ title, className, children, ...props }, ref) => (
    <View ref={ref} className={cn('gap-2', className)} {...props}>
      {title !== undefined ? <Label>{title}</Label> : null}
      {children}
    </View>
  )
)
Section.displayName = 'Section'

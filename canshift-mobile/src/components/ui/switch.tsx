import * as React from 'react'
import { Switch as RNSwitch, type SwitchProps } from 'react-native'
import { Colors } from '@/theme'

export type SwitchValueChange = (next: boolean) => void

export interface UISwitchProps extends Omit<SwitchProps, 'trackColor' | 'thumbColor'> {
  value: boolean
  onValueChange: SwitchValueChange
}

export const Switch = React.forwardRef<React.ElementRef<typeof RNSwitch>, UISwitchProps>(
  ({ value, onValueChange, disabled, ...props }, ref) => (
    <RNSwitch
      ref={ref}
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: Colors.border, true: Colors.primary }}
      thumbColor={Colors.white}
      ios_backgroundColor={Colors.border}
      {...props}
    />
  )
)
Switch.displayName = 'Switch'

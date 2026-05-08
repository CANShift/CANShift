import * as React from 'react'
import { Pressable, View, type PressableProps } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { cn } from '@/lib/utils'
import { Colors } from '@/theme'

export interface CheckboxProps extends Omit<PressableProps, 'onPress' | 'style' | 'children'> {
  checked: boolean
  onCheckedChange: (next: boolean) => void
  disabled?: boolean
  className?: string
}

export const Checkbox = React.forwardRef<React.ElementRef<typeof Pressable>, CheckboxProps>(
  ({ checked, onCheckedChange, disabled, className, ...props }, ref) => {
    return (
      <Pressable
        ref={ref}
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled: disabled ?? false }}
        disabled={disabled}
        onPress={() => {
          onCheckedChange(!checked)
        }}
        className={cn(
          'h-4 w-4 items-center justify-center rounded-sm border-[1.5px] border-primary',
          checked && 'bg-primary',
          disabled && 'opacity-50',
          className,
        )}
        {...props}
      >
        {checked ? (
          <View pointerEvents="none">
            <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
              <Path
                d="M5 12.5L10 17.5L19 7.5"
                stroke={Colors.primaryForeground}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        ) : null}
      </Pressable>
    )
  },
)
Checkbox.displayName = 'Checkbox'

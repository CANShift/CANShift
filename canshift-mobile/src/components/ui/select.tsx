import * as React from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  type PressableProps,
  type TextProps,
  type ViewProps,
} from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { cn } from '@/lib/utils'
import { Colors } from '@/theme'

interface SelectContextValue {
  value: string
  setValue: (next: string) => void
  open: boolean
  setOpen: (next: boolean) => void
  placeholder: string | undefined
}

const SelectContext = React.createContext<SelectContextValue | null>(null)

function useSelectContext(): SelectContextValue {
  const ctx = React.useContext(SelectContext)
  if (ctx === null) {
    throw new Error('Select subcomponents must be used within a <Select>')
  }
  return ctx
}

export interface SelectProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  children: React.ReactNode
}

export function Select({
  value,
  defaultValue,
  onValueChange,
  placeholder,
  children,
}: SelectProps): React.ReactElement {
  const isControlledRef = React.useRef(value !== undefined)
  const [internalValue, setInternalValue] = React.useState<string>(defaultValue ?? '')
  const [open, setOpenState] = React.useState<boolean>(false)

  const isControlled = isControlledRef.current
  const currentValue = isControlled ? (value ?? '') : internalValue

  const setValue = React.useCallback(
    (next: string): void => {
      if (!isControlled) {
        setInternalValue(next)
      }
      onValueChange?.(next)
    },
    [isControlled, onValueChange]
  )

  const setOpen = React.useCallback((next: boolean): void => {
    setOpenState(next)
  }, [])

  const ctxValue = React.useMemo<SelectContextValue>(
    () => ({ value: currentValue, setValue, open, setOpen, placeholder }),
    [currentValue, setValue, open, setOpen, placeholder]
  )

  return <SelectContext.Provider value={ctxValue}>{children}</SelectContext.Provider>
}
Select.displayName = 'Select'

export interface SelectTriggerProps extends Omit<PressableProps, 'onPress' | 'style' | 'children'> {
  children?: React.ReactNode
  className?: string
}

export const SelectTrigger = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  SelectTriggerProps
>(({ children, className, disabled, ...props }, ref) => {
  const ctx = useSelectContext()
  return (
    <Pressable
      ref={ref}
      accessibilityRole="combobox"
      accessibilityState={{ expanded: ctx.open, disabled: disabled ?? false }}
      disabled={disabled}
      onPress={() => {
        ctx.setOpen(true)
      }}
      className={cn(
        'h-12 flex-row items-center justify-between rounded-md border border-border bg-surface px-3',
        disabled && 'opacity-50',
        className
      )}
      {...props}
    >
      <View className="flex-1 flex-row items-center">{children}</View>
      <View pointerEvents="none" className="ml-2">
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path
            d="M6 9L12 15L18 9"
            stroke={Colors.textMuted}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    </Pressable>
  )
})
SelectTrigger.displayName = 'SelectTrigger'

export interface SelectValueProps extends Omit<TextProps, 'children'> {
  className?: string
  placeholder?: string
}

export function SelectValue({
  className,
  placeholder,
  ...props
}: SelectValueProps): React.ReactElement {
  const ctx = useSelectContext()
  const display = ctx.value !== '' ? ctx.value : (placeholder ?? ctx.placeholder ?? '')
  const isPlaceholder = ctx.value === ''
  return (
    <Text
      numberOfLines={1}
      className={cn('text-base', isPlaceholder ? 'text-text-muted' : 'text-text', className)}
      {...props}
    >
      {display}
    </Text>
  )
}
SelectValue.displayName = 'SelectValue'

export interface SelectContentProps {
  children: React.ReactNode
  className?: string
  overlayClassName?: string
  dismissOnBackdropPress?: boolean
}

export function SelectContent({
  children,
  className,
  overlayClassName,
  dismissOnBackdropPress = true,
}: SelectContentProps): React.ReactElement {
  const ctx = useSelectContext()
  return (
    <Modal
      visible={ctx.open}
      transparent
      animationType="fade"
      onRequestClose={() => {
        ctx.setOpen(false)
      }}
    >
      <Pressable
        accessibilityRole="button"
        onPress={
          dismissOnBackdropPress
            ? () => {
                ctx.setOpen(false)
              }
            : undefined
        }
        className={cn('flex-1 items-center justify-center bg-black/60 px-4', overlayClassName)}
      >
        <View
          accessibilityRole="menu"
          accessibilityViewIsModal
          className={cn(
            'mx-6 max-w-md w-full self-center rounded-lg border border-border bg-surface py-2 shadow-lg',
            className
          )}
        >
          <ScrollView>{children}</ScrollView>
        </View>
      </Pressable>
    </Modal>
  )
}
SelectContent.displayName = 'SelectContent'

export interface SelectItemProps extends Omit<PressableProps, 'onPress' | 'style' | 'children'> {
  value: string
  children: React.ReactNode
  className?: string
  textClassName?: string
}

export const SelectItem = React.forwardRef<React.ComponentRef<typeof Pressable>, SelectItemProps>(
  ({ value, children, className, textClassName, disabled, ...props }, ref) => {
    const ctx = useSelectContext()
    const selected = ctx.value === value
    return (
      <Pressable
        ref={ref}
        accessibilityRole="menuitem"
        accessibilityState={{ selected, disabled: disabled ?? false }}
        disabled={disabled}
        onPress={() => {
          ctx.setValue(value)
          ctx.setOpen(false)
        }}
        className={cn(
          'flex-row items-center justify-between px-3 py-3',
          selected && 'bg-surface-2',
          disabled && 'opacity-50',
          className
        )}
        {...props}
      >
        {typeof children === 'string' ? (
          <Text className={cn('text-base text-text', textClassName)}>{children}</Text>
        ) : (
          children
        )}
        {selected ? (
          <View pointerEvents="none">
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path
                d="M5 12.5L10 17.5L19 7.5"
                stroke={Colors.primary}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        ) : null}
      </Pressable>
    )
  }
)
SelectItem.displayName = 'SelectItem'

export interface SelectGroupProps extends ViewProps {
  className?: string
}

export function SelectGroup({ className, ...props }: SelectGroupProps): React.ReactElement {
  return <View className={cn('flex-col', className)} {...props} />
}
SelectGroup.displayName = 'SelectGroup'

export interface SelectLabelProps extends TextProps {
  className?: string
}

export function SelectLabel({ className, ...props }: SelectLabelProps): React.ReactElement {
  return (
    <Text
      className={cn('px-3 py-2 text-xs font-semibold uppercase text-text-muted', className)}
      {...props}
    />
  )
}
SelectLabel.displayName = 'SelectLabel'

export interface SelectSeparatorProps extends ViewProps {
  className?: string
}

export function SelectSeparator({ className, ...props }: SelectSeparatorProps): React.ReactElement {
  return <View className={cn('my-1 h-px bg-border', className)} {...props} />
}
SelectSeparator.displayName = 'SelectSeparator'

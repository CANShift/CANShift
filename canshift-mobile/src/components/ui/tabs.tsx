import * as React from 'react'
import { Pressable, Text, View, type PressableProps, type ViewProps } from 'react-native'
import { cn } from '@/lib/utils'

interface TabsContextValue {
  value: string
  setValue: (next: string) => void
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

function useTabsContext(): TabsContextValue {
  const ctx = React.useContext(TabsContext)
  if (ctx === null) {
    throw new Error('Tabs subcomponents must be used within a <Tabs>')
  }
  return ctx
}

export interface TabsProps extends Omit<ViewProps, 'children'> {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  className?: string
}

export function Tabs({
  value,
  defaultValue,
  onValueChange,
  children,
  className,
  ...props
}: TabsProps): React.ReactElement {
  const isControlledRef = React.useRef(value !== undefined)
  const [internalValue, setInternalValue] = React.useState<string>(defaultValue ?? '')

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

  const ctxValue = React.useMemo<TabsContextValue>(
    () => ({ value: currentValue, setValue }),
    [currentValue, setValue]
  )

  return (
    <TabsContext.Provider value={ctxValue}>
      <View className={cn('flex-col gap-2', className)} {...props}>
        {children}
      </View>
    </TabsContext.Provider>
  )
}
Tabs.displayName = 'Tabs'

export interface TabsListProps extends ViewProps {
  className?: string
}

export function TabsList({ className, ...props }: TabsListProps): React.ReactElement {
  return (
    <View
      accessibilityRole="tablist"
      className={cn('flex-row items-center rounded-md bg-surface-2 p-1', className)}
      {...props}
    />
  )
}
TabsList.displayName = 'TabsList'

export interface TabsTriggerProps extends Omit<PressableProps, 'onPress' | 'style' | 'children'> {
  value: string
  children: React.ReactNode
  className?: string
  textClassName?: string
}

export const TabsTrigger = React.forwardRef<React.ComponentRef<typeof Pressable>, TabsTriggerProps>(
  ({ value, children, className, textClassName, disabled, ...props }, ref) => {
    const ctx = useTabsContext()
    const active = ctx.value === value
    return (
      <Pressable
        ref={ref}
        accessibilityRole="tab"
        accessibilityState={{ selected: active, disabled: disabled ?? false }}
        disabled={disabled}
        onPress={() => {
          ctx.setValue(value)
        }}
        className={cn(
          'flex-1 flex-row items-center justify-center rounded-sm px-3 py-2',
          active ? 'bg-surface' : 'bg-transparent',
          disabled && 'opacity-50',
          className
        )}
        {...props}
      >
        {typeof children === 'string' ? (
          <Text
            className={cn(
              'text-sm font-medium',
              active ? 'text-text' : 'text-text-muted',
              textClassName
            )}
          >
            {children}
          </Text>
        ) : (
          children
        )}
      </Pressable>
    )
  }
)
TabsTrigger.displayName = 'TabsTrigger'

export interface TabsContentProps extends ViewProps {
  value: string
  className?: string
}

export function TabsContent({
  value,
  className,
  ...props
}: TabsContentProps): React.ReactElement | null {
  const ctx = useTabsContext()
  if (ctx.value !== value) {
    return null
  }
  return <View className={cn('flex-col', className)} {...props} />
}
TabsContent.displayName = 'TabsContent'

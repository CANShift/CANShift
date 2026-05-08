import * as React from 'react'
import {
  Modal,
  Pressable,
  Text,
  View,
  type PressableProps,
  type TextProps,
  type ViewProps,
} from 'react-native'
import { cn } from '@/lib/utils'
import { Button, type ButtonProps } from './button'

interface AlertDialogContextValue {
  open: boolean
  setOpen: (next: boolean) => void
}

const AlertDialogContext = React.createContext<AlertDialogContextValue | null>(null)

function useAlertDialogContext(): AlertDialogContextValue {
  const ctx = React.useContext(AlertDialogContext)
  if (ctx === null) {
    throw new Error('AlertDialog subcomponents must be used within an <AlertDialog>')
  }
  return ctx
}

export interface AlertDialogProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

export function AlertDialog({
  open,
  defaultOpen,
  onOpenChange,
  children,
}: AlertDialogProps): React.ReactElement {
  const isControlledRef = React.useRef(open !== undefined)
  const [internalOpen, setInternalOpen] = React.useState<boolean>(defaultOpen ?? false)

  const isControlled = isControlledRef.current
  const currentOpen = isControlled ? (open ?? false) : internalOpen

  const setOpen = React.useCallback(
    (next: boolean): void => {
      if (!isControlled) {
        setInternalOpen(next)
      }
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange],
  )

  const value = React.useMemo<AlertDialogContextValue>(
    () => ({ open: currentOpen, setOpen }),
    [currentOpen, setOpen],
  )

  return <AlertDialogContext.Provider value={value}>{children}</AlertDialogContext.Provider>
}
AlertDialog.displayName = 'AlertDialog'

export interface AlertDialogTriggerProps extends Omit<PressableProps, 'onPress' | 'style'> {
  children: React.ReactNode
  className?: string
}

export const AlertDialogTrigger = React.forwardRef<
  React.ElementRef<typeof Pressable>,
  AlertDialogTriggerProps
>(({ children, className, ...props }, ref) => {
  const { setOpen } = useAlertDialogContext()
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      onPress={() => {
        setOpen(true)
      }}
      className={cn(className)}
      {...props}
    >
      {children}
    </Pressable>
  )
})
AlertDialogTrigger.displayName = 'AlertDialogTrigger'

export interface AlertDialogContentProps {
  children: React.ReactNode
  className?: string
  overlayClassName?: string
}

export function AlertDialogContent({
  children,
  className,
  overlayClassName,
}: AlertDialogContentProps): React.ReactElement {
  const { open, setOpen } = useAlertDialogContext()
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => {
        setOpen(false)
      }}
    >
      <View
        className={cn('flex-1 items-center justify-center bg-black/60 px-4', overlayClassName)}
      >
        <View
          accessibilityViewIsModal
          accessibilityRole="alert"
          className={cn(
            'mx-6 max-w-md w-full self-center rounded-lg border border-border bg-surface p-6 shadow-lg',
            className,
          )}
        >
          {children}
        </View>
      </View>
    </Modal>
  )
}
AlertDialogContent.displayName = 'AlertDialogContent'

export interface AlertDialogHeaderProps extends ViewProps {
  className?: string
}

export function AlertDialogHeader({
  className,
  ...props
}: AlertDialogHeaderProps): React.ReactElement {
  return (
    <View
      accessibilityRole="header"
      className={cn('flex-col gap-1.5', className)}
      {...props}
    />
  )
}
AlertDialogHeader.displayName = 'AlertDialogHeader'

export interface AlertDialogFooterProps extends ViewProps {
  className?: string
}

export function AlertDialogFooter({
  className,
  ...props
}: AlertDialogFooterProps): React.ReactElement {
  return <View className={cn('flex-row justify-end gap-2 mt-4', className)} {...props} />
}
AlertDialogFooter.displayName = 'AlertDialogFooter'

export interface AlertDialogTitleProps extends TextProps {
  className?: string
}

export function AlertDialogTitle({
  className,
  ...props
}: AlertDialogTitleProps): React.ReactElement {
  return (
    <Text
      accessibilityRole="header"
      className={cn('text-lg font-semibold text-text', className)}
      {...props}
    />
  )
}
AlertDialogTitle.displayName = 'AlertDialogTitle'

export interface AlertDialogDescriptionProps extends TextProps {
  className?: string
}

export function AlertDialogDescription({
  className,
  ...props
}: AlertDialogDescriptionProps): React.ReactElement {
  return <Text className={cn('text-sm text-text-muted', className)} {...props} />
}
AlertDialogDescription.displayName = 'AlertDialogDescription'

export interface AlertDialogActionProps extends Omit<ButtonProps, 'onPress'> {
  onPress?: ButtonProps['onPress']
}

export const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof Pressable>,
  AlertDialogActionProps
>(({ onPress, variant = 'destructive', children, ...props }, ref) => {
  const { setOpen } = useAlertDialogContext()
  return (
    <Button
      ref={ref}
      variant={variant}
      onPress={(event) => {
        onPress?.(event)
        setOpen(false)
      }}
      {...props}
    >
      {children}
    </Button>
  )
})
AlertDialogAction.displayName = 'AlertDialogAction'

export interface AlertDialogCancelProps extends Omit<ButtonProps, 'onPress'> {
  onPress?: ButtonProps['onPress']
}

export const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof Pressable>,
  AlertDialogCancelProps
>(({ onPress, variant = 'outline', children, ...props }, ref) => {
  const { setOpen } = useAlertDialogContext()
  return (
    <Button
      ref={ref}
      variant={variant}
      onPress={(event) => {
        onPress?.(event)
        setOpen(false)
      }}
      {...props}
    >
      {children}
    </Button>
  )
})
AlertDialogCancel.displayName = 'AlertDialogCancel'

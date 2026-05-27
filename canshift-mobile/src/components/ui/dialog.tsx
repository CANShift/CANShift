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

interface DialogContextValue {
  open: boolean
  setOpen: (next: boolean) => void
}

const DialogContext = React.createContext<DialogContextValue | null>(null)

function useDialogContext(): DialogContextValue {
  const ctx = React.useContext(DialogContext)
  if (ctx === null) {
    throw new Error('Dialog subcomponents must be used within a <Dialog>')
  }
  return ctx
}

export interface DialogProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

export function Dialog({
  open,
  defaultOpen,
  onOpenChange,
  children,
}: DialogProps): React.ReactElement {
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
    [isControlled, onOpenChange]
  )

  const value = React.useMemo<DialogContextValue>(
    () => ({ open: currentOpen, setOpen }),
    [currentOpen, setOpen]
  )

  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>
}
Dialog.displayName = 'Dialog'

export interface DialogTriggerProps extends Omit<PressableProps, 'onPress' | 'style'> {
  children: React.ReactNode
  className?: string
}

export const DialogTrigger = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  DialogTriggerProps
>(({ children, className, ...props }, ref) => {
  const { setOpen } = useDialogContext()
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
DialogTrigger.displayName = 'DialogTrigger'

export interface DialogContentProps {
  children: React.ReactNode
  className?: string
  overlayClassName?: string
  dismissOnBackdropPress?: boolean
}

export function DialogContent({
  children,
  className,
  overlayClassName,
  dismissOnBackdropPress = true,
}: DialogContentProps): React.ReactElement {
  const { open, setOpen } = useDialogContext()
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => {
        setOpen(false)
      }}
    >
      <Pressable
        accessibilityRole="button"
        onPress={
          dismissOnBackdropPress
            ? () => {
                setOpen(false)
              }
            : undefined
        }
        className={cn('flex-1 items-center justify-center bg-black/60 px-4', overlayClassName)}
      >
        <View
          accessibilityViewIsModal
          className={cn(
            'mx-6 max-w-md w-full self-center rounded-lg border border-border bg-surface p-6 shadow-lg',
            className
          )}
        >
          {children}
        </View>
      </Pressable>
    </Modal>
  )
}
DialogContent.displayName = 'DialogContent'

export interface DialogHeaderProps extends ViewProps {
  className?: string
}

export function DialogHeader({ className, ...props }: DialogHeaderProps): React.ReactElement {
  return (
    <View accessibilityRole="header" className={cn('flex-col gap-1.5', className)} {...props} />
  )
}
DialogHeader.displayName = 'DialogHeader'

export interface DialogFooterProps extends ViewProps {
  className?: string
}

export function DialogFooter({ className, ...props }: DialogFooterProps): React.ReactElement {
  return <View className={cn('flex-row justify-end gap-2', className)} {...props} />
}
DialogFooter.displayName = 'DialogFooter'

export interface DialogTitleProps extends TextProps {
  className?: string
}

export function DialogTitle({ className, ...props }: DialogTitleProps): React.ReactElement {
  return (
    <Text
      accessibilityRole="header"
      className={cn('text-lg font-semibold text-text', className)}
      {...props}
    />
  )
}
DialogTitle.displayName = 'DialogTitle'

export interface DialogDescriptionProps extends TextProps {
  className?: string
}

export function DialogDescription({
  className,
  ...props
}: DialogDescriptionProps): React.ReactElement {
  return <Text className={cn('text-sm text-text-muted', className)} {...props} />
}
DialogDescription.displayName = 'DialogDescription'

export interface DialogCloseProps extends Omit<PressableProps, 'onPress' | 'style'> {
  children: React.ReactNode
  className?: string
}

export const DialogClose = React.forwardRef<React.ComponentRef<typeof Pressable>, DialogCloseProps>(
  ({ children, className, ...props }, ref) => {
    const { setOpen } = useDialogContext()
    return (
      <Pressable
        ref={ref}
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={() => {
          setOpen(false)
        }}
        className={cn(className)}
        {...props}
      >
        {children}
      </Pressable>
    )
  }
)
DialogClose.displayName = 'DialogClose'

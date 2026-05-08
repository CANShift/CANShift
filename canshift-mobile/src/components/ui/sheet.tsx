import * as React from 'react'
import {
  Modal,
  Pressable,
  Text,
  View,
  type ModalProps,
  type PressableProps,
  type TextProps,
  type ViewProps,
} from 'react-native'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

interface SheetContextValue {
  open: boolean
  setOpen: (next: boolean) => void
}

const SheetContext = React.createContext<SheetContextValue | null>(null)

function useSheetContext(): SheetContextValue {
  const ctx = React.useContext(SheetContext)
  if (ctx === null) {
    throw new Error('Sheet subcomponents must be used within a <Sheet>')
  }
  return ctx
}

export type SheetSide = 'top' | 'bottom' | 'left' | 'right'

const sheetContentVariants = cva(
  'absolute border-border bg-surface',
  {
    variants: {
      side: {
        top: 'top-0 left-0 right-0 rounded-b-lg border-b',
        bottom: 'bottom-0 left-0 right-0 rounded-t-lg border-t',
        left: 'top-0 bottom-0 left-0 w-3/4 rounded-r-lg border-r',
        right: 'top-0 bottom-0 right-0 w-3/4 rounded-l-lg border-l',
      },
    },
    defaultVariants: { side: 'bottom' },
  },
)

type SheetContentVariantProps = VariantProps<typeof sheetContentVariants>

export interface SheetProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

export function Sheet({
  open,
  defaultOpen,
  onOpenChange,
  children,
}: SheetProps): React.ReactElement {
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

  const value = React.useMemo<SheetContextValue>(
    () => ({ open: currentOpen, setOpen }),
    [currentOpen, setOpen],
  )

  return <SheetContext.Provider value={value}>{children}</SheetContext.Provider>
}
Sheet.displayName = 'Sheet'

export interface SheetTriggerProps extends Omit<PressableProps, 'onPress' | 'style'> {
  children: React.ReactNode
  className?: string
}

export const SheetTrigger = React.forwardRef<
  React.ElementRef<typeof Pressable>,
  SheetTriggerProps
>(({ children, className, ...props }, ref) => {
  const { setOpen } = useSheetContext()
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
SheetTrigger.displayName = 'SheetTrigger'

function resolveAnimationType(side: SheetSide): NonNullable<ModalProps['animationType']> {
  switch (side) {
    case 'top':
    case 'bottom':
      return 'slide'
    case 'left':
    case 'right':
      return 'fade'
    default: {
      const _exhaustive: never = side
      return _exhaustive
    }
  }
}

function resolveOverlayAlignment(side: SheetSide): string {
  switch (side) {
    case 'top':
      return 'justify-start'
    case 'bottom':
      return 'justify-end'
    case 'left':
      return 'items-start'
    case 'right':
      return 'items-end'
    default: {
      const _exhaustive: never = side
      return _exhaustive
    }
  }
}

export interface SheetContentProps extends SheetContentVariantProps {
  children: React.ReactNode
  className?: string
  overlayClassName?: string
  dismissOnBackdropPress?: boolean
}

export function SheetContent({
  children,
  className,
  overlayClassName,
  dismissOnBackdropPress = true,
  side,
}: SheetContentProps): React.ReactElement {
  const { open, setOpen } = useSheetContext()
  const resolvedSide: SheetSide = side ?? 'bottom'
  const animationType = resolveAnimationType(resolvedSide)
  const overlayAlignment = resolveOverlayAlignment(resolvedSide)
  return (
    <Modal
      visible={open}
      transparent
      animationType={animationType}
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
        className={cn('flex-1 bg-black/60', overlayAlignment, overlayClassName)}
      >
        <Pressable
          accessibilityViewIsModal
          onPress={(event) => {
            event.stopPropagation()
          }}
          className={cn(
            sheetContentVariants({ side: resolvedSide }),
            'border p-6 shadow-lg',
            className,
          )}
        >
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  )
}
SheetContent.displayName = 'SheetContent'

export interface SheetHeaderProps extends ViewProps {
  className?: string
}

export function SheetHeader({ className, ...props }: SheetHeaderProps): React.ReactElement {
  return (
    <View
      accessibilityRole="header"
      className={cn('flex-col gap-1.5', className)}
      {...props}
    />
  )
}
SheetHeader.displayName = 'SheetHeader'

export interface SheetFooterProps extends ViewProps {
  className?: string
}

export function SheetFooter({ className, ...props }: SheetFooterProps): React.ReactElement {
  return <View className={cn('flex-row justify-end gap-2', className)} {...props} />
}
SheetFooter.displayName = 'SheetFooter'

export interface SheetTitleProps extends TextProps {
  className?: string
}

export function SheetTitle({ className, ...props }: SheetTitleProps): React.ReactElement {
  return (
    <Text
      accessibilityRole="header"
      className={cn('text-lg font-semibold text-text', className)}
      {...props}
    />
  )
}
SheetTitle.displayName = 'SheetTitle'

export interface SheetDescriptionProps extends TextProps {
  className?: string
}

export function SheetDescription({
  className,
  ...props
}: SheetDescriptionProps): React.ReactElement {
  return <Text className={cn('text-sm text-text-muted', className)} {...props} />
}
SheetDescription.displayName = 'SheetDescription'

export interface SheetCloseProps extends Omit<PressableProps, 'onPress' | 'style'> {
  children: React.ReactNode
  className?: string
}

export const SheetClose = React.forwardRef<
  React.ElementRef<typeof Pressable>,
  SheetCloseProps
>(({ children, className, ...props }, ref) => {
  const { setOpen } = useSheetContext()
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
})
SheetClose.displayName = 'SheetClose'

export { sheetContentVariants }

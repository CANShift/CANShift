import * as React from 'react'
import RNToast, {
  BaseToast,
  ErrorToast,
  type BaseToastProps,
  type ToastConfig,
} from 'react-native-toast-message'
import { Colors } from '@/theme'

const baseStyle = {
  backgroundColor: Colors.surface,
  borderLeftWidth: 4,
  borderColor: Colors.border,
  borderTopWidth: 1,
  borderRightWidth: 1,
  borderBottomWidth: 1,
  borderRadius: 8,
  height: 'auto' as const,
  minHeight: 60,
  paddingVertical: 8,
} as const

const text1Style = {
  color: Colors.text,
  fontSize: 15,
  fontWeight: '600' as const,
}

const text2Style = {
  color: Colors.textDim,
  fontSize: 13,
}

const toastConfig: ToastConfig = {
  success: (props: BaseToastProps) => (
    <BaseToast
      {...props}
      style={{ ...baseStyle, borderLeftColor: Colors.success }}
      contentContainerStyle={{ paddingHorizontal: 12 }}
      text1Style={text1Style}
      text2Style={text2Style}
    />
  ),
  error: (props: BaseToastProps) => (
    <ErrorToast
      {...props}
      style={{ ...baseStyle, borderLeftColor: Colors.danger }}
      contentContainerStyle={{ paddingHorizontal: 12 }}
      text1Style={text1Style}
      text2Style={text2Style}
    />
  ),
  info: (props: BaseToastProps) => (
    <BaseToast
      {...props}
      style={{ ...baseStyle, borderLeftColor: Colors.accent }}
      contentContainerStyle={{ paddingHorizontal: 12 }}
      text1Style={text1Style}
      text2Style={text2Style}
    />
  ),
}

export const Toaster = (): React.ReactElement => {
  return <RNToast config={toastConfig} />
}
Toaster.displayName = 'Toaster'

export { RNToast as Toast }
export type {
  ToastShowParams,
  ToastConfig,
  ToastType,
  ToastPosition,
} from 'react-native-toast-message'

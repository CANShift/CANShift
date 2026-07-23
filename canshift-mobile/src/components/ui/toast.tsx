import * as React from 'react'
import { StyleSheet } from 'react-native'
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

const styles = StyleSheet.create({
  success: { ...baseStyle, borderLeftColor: Colors.success },
  error: { ...baseStyle, borderLeftColor: Colors.danger },
  info: { ...baseStyle, borderLeftColor: Colors.accent },
  content: { paddingHorizontal: 12 },
  text1: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  text2: { color: Colors.textDim, fontSize: 13 },
})

const toastConfig: ToastConfig = {
  success: (props: BaseToastProps) => (
    <BaseToast
      {...props}
      style={styles.success}
      contentContainerStyle={styles.content}
      text1Style={styles.text1}
      text2Style={styles.text2}
    />
  ),
  error: (props: BaseToastProps) => (
    <ErrorToast
      {...props}
      style={styles.error}
      contentContainerStyle={styles.content}
      text1Style={styles.text1}
      text2Style={styles.text2}
    />
  ),
  info: (props: BaseToastProps) => (
    <BaseToast
      {...props}
      style={styles.info}
      contentContainerStyle={styles.content}
      text1Style={styles.text1}
      text2Style={styles.text2}
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

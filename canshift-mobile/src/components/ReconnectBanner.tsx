import React, { useCallback } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useShallow } from 'zustand/react/shallow'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Colors, Typography, Spacing, HitSlop } from '../theme'
import { useDeviceStore } from '../stores/device.store'
import { useReconnectStore } from '../stores/reconnect.store'
import * as BleService from '../services/ble.service'
import type { RootStackParamList } from '../navigation'

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Connected'>
}

export default function ReconnectBanner({ navigation }: Props) {
  const insets = useSafeAreaInsets()
  const isSim = useDeviceStore((s) => s.mode === 'sim')
  const { isReconnecting, attempt, maxAttempts } = useReconnectStore(
    useShallow((s) => ({
      isReconnecting: s.isReconnecting,
      attempt: s.attempt,
      maxAttempts: s.maxAttempts,
    }))
  )

  const cancelAndGoToScan = useCallback(() => {
    BleService.cancelReconnect()
    useDeviceStore.getState().clearError()
    navigation.replace('Scan')
  }, [navigation])

  if (isSim || !isReconnecting) return null

  return (
    <View
      style={[styles.banner, { paddingTop: insets.top + Spacing.sm }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <ActivityIndicator color={Colors.statusDanger} size="small" />
      <Text style={styles.text}>
        {`Reconnecting… (attempt ${String(attempt)}/${String(maxAttempts)})`}
      </Text>
      <TouchableOpacity
        onPress={cancelAndGoToScan}
        hitSlop={HitSlop.default}
        accessibilityRole="button"
        accessibilityLabel="Cancel reconnecting and return to scan"
      >
        <Text style={styles.cancel}>Cancel</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.statusDangerDim,
    borderBottomWidth: 1,
    borderBottomColor: Colors.statusDanger,
  },
  text: { flex: 1, fontSize: Typography.sm, color: Colors.text },
  cancel: { fontSize: Typography.sm, color: Colors.statusDanger, fontWeight: '700' },
})

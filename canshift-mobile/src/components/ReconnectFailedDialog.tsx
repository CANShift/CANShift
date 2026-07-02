import React, { useCallback } from 'react'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useDeviceStore } from '../stores/device.store'
import { useReconnectStore } from '../stores/reconnect.store'
import * as BleService from '../services/ble.service'
import type { RootStackParamList } from '../navigation'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog'

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Connected'>
}

export default function ReconnectFailedDialog({ navigation }: Props) {
  const isSim = useDeviceStore((s) => s.mode === 'sim')
  const hasError = useDeviceStore((s) => s.error !== null)
  const isReconnecting = useReconnectStore((s) => s.isReconnecting)
  const open = !isSim && !isReconnecting && hasError

  const backToScan = useCallback(() => {
    useDeviceStore.getState().clearError()
    navigation.replace('Scan')
  }, [navigation])

  const retry = useCallback(async () => {
    const started = await BleService.tryReconnectLastDevice()
    if (!started) backToScan()
  }, [backToScan])

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Connection lost</AlertDialogTitle>
          <AlertDialogDescription>
            Could not reconnect to the dashboard. Make sure it is powered on and in range.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onPress={backToScan}>Back to scan</AlertDialogCancel>
          <AlertDialogAction variant="default" onPress={() => void retry()}>
            Retry
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

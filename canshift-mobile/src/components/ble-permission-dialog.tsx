import React from 'react'
import { Linking } from 'react-native'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui'

export type BlePermissionPlatform = 'ios' | 'android'

const unauthorizedMessage = (platform: BlePermissionPlatform): string => {
  return platform === 'android'
    ? 'CANShift needs nearby devices permission. Open app settings to grant it.'
    : 'CANShift needs Bluetooth access to find your dashboard. Open Settings to grant permission.'
}

interface Props {
  platform: BlePermissionPlatform | null
  onDismiss: () => void
}

export const BlePermissionDialog = ({ platform, onDismiss }: Props) => {
  return (
    <AlertDialog
      open={platform !== null}
      onOpenChange={(next) => {
        if (!next) onDismiss()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Bluetooth permission needed</AlertDialogTitle>
          <AlertDialogDescription>
            {platform !== null ? unauthorizedMessage(platform) : ''}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="default" onPress={() => void Linking.openSettings()}>
            Open Settings
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

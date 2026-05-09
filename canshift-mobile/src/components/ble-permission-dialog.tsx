// ble-permission-dialog.tsx — Shared "open Settings" prompt for BLE perms
//
// Both `ScanScreen` and the in-flow screens (`SettingsScreen`, `UpdateScreen`)
// can hit `permission-denied` from the same `BleConnectionError` union. This
// component renders the same AlertDialog with platform-aware copy and an
// "Open Settings" CTA so the call sites stay one-liners.

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

function unauthorizedMessage(platform: BlePermissionPlatform): string {
  return platform === 'android'
    ? 'CANShift needs nearby devices permission. Open app settings to grant it.'
    : 'CANShift needs Bluetooth access to find your dashboard. Open Settings to grant permission.'
}

interface Props {
  /** When non-null, the dialog is open and renders copy for that platform. */
  platform: BlePermissionPlatform | null
  /** Called when the user dismisses the dialog (cancel, backdrop, or after action). */
  onDismiss: () => void
}

export function BlePermissionDialog({ platform, onDismiss }: Props) {
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
          <AlertDialogAction
            variant="default"
            onPress={() => void Linking.openSettings()}
          >
            Open Settings
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

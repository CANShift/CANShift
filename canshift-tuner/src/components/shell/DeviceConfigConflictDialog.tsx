import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog'
import { useDashboardStore } from '../../stores/dashboard.store'
import { useLogStore } from '../../stores/log.store'

export const DeviceConfigConflictDialog = () => {
  const pendingDeviceConfig = useDashboardStore((s) => s.pendingDeviceConfig)
  const acceptPendingDeviceConfig = useDashboardStore((s) => s.acceptPendingDeviceConfig)
  const dismissPendingDeviceConfig = useDashboardStore((s) => s.dismissPendingDeviceConfig)
  const log = useLogStore((s) => s.push)

  return (
    <AlertDialog
      open={pendingDeviceConfig !== null}
      onOpenChange={(open) => {
        if (!open) dismissPendingDeviceConfig()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Device config differs</AlertDialogTitle>
          <AlertDialogDescription>
            The connected device sent a dashboard config, but you have unsaved edits. Loading from
            the device will discard your edits. Keeping your edits leaves the device untouched until
            you burn.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => {
              dismissPendingDeviceConfig()
              log('info', 'Kept local edits — device config ignored')
            }}
          >
            Keep my edits
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              acceptPendingDeviceConfig()
              log('success', 'Loaded config from device — local edits discarded')
            }}
          >
            Load from device
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

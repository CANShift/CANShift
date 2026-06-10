export type AndroidBlePermissionResult =
  | { kind: 'granted' }
  | { kind: 'denied' }
  | { kind: 'never_ask_again' }
  | { kind: 'not_applicable' }

export declare function requestAndroidBlePermissions(): Promise<AndroidBlePermissionResult>

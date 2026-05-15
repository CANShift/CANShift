// Android: keep Play Store happy by declaring that BLE scanning never
// derives physical location, and gate the legacy ACCESS_FINE_LOCATION
// permission so it only prompts on Android 11 and below (where the BLE
// stack actually required it).
//
// Without this:
//   • Play Store review flags location use even though we never read it.
//   • Users on Android 12+ get an unnecessary location-permission prompt.

const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins')

const ANDROID_NS = 'http://schemas.android.com/apk/res/android'

function withBluetoothScanNeverForLocation(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest
    const permissions = manifest['uses-permission'] ?? []

    for (const perm of permissions) {
      const name = perm.$['android:name']
      if (name === 'android.permission.BLUETOOTH_SCAN') {
        perm.$['android:usesPermissionFlags'] = 'neverForLocation'
      } else if (name === 'android.permission.ACCESS_FINE_LOCATION') {
        // Pre-Android 12 BLE scanning required this. From API 31+ the
        // BLUETOOTH_SCAN permission replaces it entirely.
        perm.$['android:maxSdkVersion'] = '30'
      }
    }

    // Make sure xmlns:android is present on the manifest root — some
    // expo templates omit it on hand-edited blocks.
    manifest.$['xmlns:android'] = manifest.$['xmlns:android'] ?? ANDROID_NS

    return config
  })
}

// Reference AndroidConfig to flag for upstream that we depend on it; silences
// unused-require lint if it ever gains tooling.
void AndroidConfig

module.exports = withBluetoothScanNeverForLocation

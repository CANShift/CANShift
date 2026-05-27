// Patches the Podfile post_install hook to pin every Pod target to Swift 5
// language mode and minimal strict-concurrency checking. ExpoModulesCore
// 55.0.25 doesn't compile under Xcode 16's default complete concurrency
// rules — `AnyExpoSwiftUIHostingView`, `SwiftUIViewHost`, and ~10 related
// types fail with `main actor-isolated init() in synchronous nonisolated
// context`. The failure is in the Expo library itself, not user code.
// Revisit when Expo SDK 56 lands or ExpoModulesCore ships a Swift 6 patch.
const { withDangerousMod } = require('@expo/config-plugins')
const fs = require('fs')
const path = require('path')

const PATCH_MARKER = '# canshift-swift-strict-concurrency-expo55'
const PATCH = `
    ${PATCH_MARKER}
    # ExpoModulesCore 55.0.25 fails under Xcode 16's default complete
    # concurrency checking. Pin every Pod to Swift 5 + minimal strict
    # concurrency until Expo lands a Swift 6-ready release. See CANShift#1151.
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['SWIFT_VERSION'] = '5.0'
        config.build_settings['SWIFT_STRICT_CONCURRENCY'] = 'minimal'
      end
    end
`

module.exports = function withSwiftStrictConcurrencyFix(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile')
      const podfile = fs.readFileSync(podfilePath, 'utf8')

      if (podfile.includes(PATCH_MARKER)) {
        return config
      }

      const insertionRegex = /\n( {2}end\nend\s*\n?)$/
      if (!insertionRegex.test(podfile)) {
        throw new Error(
          'withSwiftStrictConcurrencyFix: could not locate post_install closing in Podfile. ' +
            'The plugin needs an update for the current Expo template.'
        )
      }

      const patched = podfile.replace(insertionRegex, `${PATCH}\n$1`)
      fs.writeFileSync(podfilePath, patched)
      return config
    },
  ])
}

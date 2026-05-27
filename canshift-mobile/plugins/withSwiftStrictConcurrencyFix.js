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
    # concurrency checking. Set every Pod target to minimal strict-
    # concurrency so the legacy "warn, don't error" rules apply. An
    # earlier revision also forced SWIFT_VERSION=5.0 but that disabled
    # @MainActor recognition (introduced in Swift 5.5) — Expo uses
    # @MainActor at every host-view declaration, so downgrading the
    # language version broke compilation a different way ("unknown
    # attribute 'MainActor'" × 12). Keep the Swift version at the project
    # default and only relax the concurrency mode. See CANShift#1151 / #1155.
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['SWIFT_STRICT_CONCURRENCY'] = 'minimal'
      end
    end
    # Apply at xcconfig level too — target build_settings don't always
    # override per-pod podspec swift_compiler flags on ExpoModulesCore.
    # xcconfig is read by xcodebuild as the last word.
    installer.target_installation_results.pod_target_installation_results.each do |pod_name, _result|
      ['Debug', 'Release'].each do |cfg|
        xcconfig_path = File.join(
          installer.sandbox.root,
          "Target Support Files/#{pod_name}/#{pod_name}.#{cfg.downcase}.xcconfig"
        )
        next unless File.exist?(xcconfig_path)
        content = File.read(xcconfig_path)
        next if content.include?('SWIFT_STRICT_CONCURRENCY')
        File.write(xcconfig_path, content + "\\nSWIFT_STRICT_CONCURRENCY = minimal\\n")
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

// Patches the Podfile post_install hook so fmt and glog pods build with
// C++17 instead of C++20. Required for Xcode 16+ / Clang 18+ where
// __cpp_consteval is defined under C++20, which makes fmt's FMT_STRING
// consteval-only and breaks RN 0.76's bundled fmt usage.
//
// Symptom without this fix:
//   error: call to consteval function 'fmt::basic_format_string<...>'
//   is not a constant expression
//   in ios/Pods/fmt/include/fmt/format-inl.h
const { withDangerousMod } = require('@expo/config-plugins')
const fs = require('fs')
const path = require('path')

const PATCH_MARKER = '# canshift-fmt-glog-cxx17-fix'
const PATCH = `
    ${PATCH_MARKER}
    # Downgrade fmt + glog to gnu++17 so __cpp_consteval is undefined →
    # FMT_USE_CONSTEVAL=0 → FMT_STRING macros stop tripping Clang 18+.
    # Patch both target-level build settings (authoritative — pbxproj overrides
    # xcconfig) and the xcconfig files (defensive, in case CocoaPods rewrites).
    installer.pods_project.targets.each do |target|
      if ['fmt', 'glog'].include?(target.name)
        target.build_configurations.each do |config|
          config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'gnu++17'
        end
      end
    end
    ['fmt', 'glog'].each do |pod_name|
      ['Debug', 'Release'].each do |cfg|
        xcconfig_path = File.join(
          installer.sandbox.root,
          "Target Support Files/#{pod_name}/#{pod_name}.#{cfg.downcase}.xcconfig"
        )
        next unless File.exist?(xcconfig_path)
        content = File.read(xcconfig_path)
        content.gsub!(/CLANG_CXX_LANGUAGE_STANDARD = c\\+\\+20/, 'CLANG_CXX_LANGUAGE_STANDARD = gnu++17')
        File.write(xcconfig_path, content)
      end
    end
`

module.exports = function withGlogFmtFix(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile')
      const podfile = fs.readFileSync(podfilePath, 'utf8')

      if (podfile.includes(PATCH_MARKER)) {
        return config
      }

      // Insert the patch just before the final `end` that closes the
      // `post_install do |installer|` block. The block always ends with a
      // line containing `  end` (two-space indent) followed by the outer
      // target's `end`. Match that pair and inject our patch above it.
      const insertionRegex = /\n( {2}end\nend\s*\n?)$/
      if (!insertionRegex.test(podfile)) {
        throw new Error(
          'withGlogFmtFix: could not locate post_install closing in Podfile. ' +
            'The plugin needs an update for the current Expo template.'
        )
      }

      const patched = podfile.replace(insertionRegex, `${PATCH}\n$1`)
      fs.writeFileSync(podfilePath, patched)
      return config
    },
  ])
}

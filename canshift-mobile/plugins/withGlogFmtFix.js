// Patches glog's Podfile target to disable FMT_USE_CONSTEVAL.
// Required for clang 26 (Xcode 26) where FMT_STRING is treated as consteval.
const { withDangerousMod } = require('@expo/config-plugins')
const fs = require('fs')
const path = require('path')

const PATCH_MARKER = 'gnu++17'
const PATCH = `
    # Fix: libfmt base.h redefines FMT_USE_CONSTEVAL=1 via __cpp_consteval under clang 26 / C++20.
    # Downgrade fmt and glog to C++17 so __cpp_consteval is not defined → FMT_USE_CONSTEVAL=0.
    ['fmt', 'glog'].each do |pod_name|
      ['debug', 'release'].each do |cfg|
        xcconfig_path = File.join(
          installer.sandbox.root,
          "Target Support Files/\#{pod_name}/\#{pod_name}.\#{cfg}.xcconfig"
        )
        next unless File.exist?(xcconfig_path)
        content = File.read(xcconfig_path)
        content.gsub!('CLANG_CXX_LANGUAGE_STANDARD = c++20', 'CLANG_CXX_LANGUAGE_STANDARD = gnu++17')
        File.write(xcconfig_path, content)
      end
    end`

module.exports = function withGlogFmtFix(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile')
      let podfile = fs.readFileSync(podfilePath, 'utf8')

      if (!podfile.includes(PATCH_MARKER)) {
        podfile = podfile.replace(/(\n\s+end\n\nend\n?)$/, `${PATCH}\n$1`)
        fs.writeFileSync(podfilePath, podfile)
      }

      return config
    },
  ])
}

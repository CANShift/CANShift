const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '..')

const config = getDefaultConfig(projectRoot)

// Allow Metro to follow the `file:../canshift-core` linked dep up one level.
config.watchFolders = [path.resolve(workspaceRoot, 'canshift-core')]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'canshift-core/node_modules'),
]

module.exports = withNativeWind(config, { input: './global.css' })

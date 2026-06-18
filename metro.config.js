const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Help Metro resolve modules from the correct node_modules root
// instead of pnpm's virtual store (.pnpm/node_modules/…)
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
];

// Disable package exports resolution — it can cause pnpm hoisting
// conflicts with Expo's server-side rendering helpers (expo-font/server.js etc.)
config.resolver.unstable_enablePackageExports = false;

module.exports = config;

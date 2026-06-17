const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  const appDir = path.resolve(__dirname, 'app');
  const expoRouterPkg = path.resolve(__dirname, 'node_modules', 'expo-router');

  config.resolve = config.resolve || {};
  config.resolve.alias = {
    ...(config.resolve.alias || {}),
    app: appDir,
    '../../app': appDir,
    '../../../app': appDir,
    '../../../../app': appDir,
    'expo-router/entry-classic': path.join(expoRouterPkg, 'entry-classic.js'),
    'expo-router/entry': path.join(expoRouterPkg, 'entry.js'),
    'expo-router/build': path.join(expoRouterPkg, 'build'),
    'expo-router/build/qualified-entry': path.join(expoRouterPkg, 'build', 'qualified-entry.js'),
    'expo-router/build/qualified-entry.js': path.join(expoRouterPkg, 'build', 'qualified-entry.js'),
    '@expo/metro-runtime': path.resolve(__dirname, 'web-shims', 'expo-metro-runtime-shim.js'),
  };

  config.resolve.modules = [...(config.resolve.modules || []), path.resolve(__dirname)];

  return config;
};

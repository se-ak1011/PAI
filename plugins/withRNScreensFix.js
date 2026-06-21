/**
 * Expo config plugin that adds a post_install hook to the generated Podfile.
 * This fixes the RNScreens compile failure on Xcode 16 by ensuring all pod
 * targets use c++17 and libc++ — required by react-native-screens ~4.x.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const POST_INSTALL_SNIPPET = `
# Fix RNScreens compile failure on Xcode 16 (react-native-screens ~4.x)
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
      config.build_settings['CLANG_CXX_LIBRARY'] = 'libc++'
    end
  end
end
`;

/** @type {import('@expo/config-plugins').ConfigPlugin} */
module.exports = function withRNScreensFix(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) return config;

      let contents = fs.readFileSync(podfilePath, 'utf-8');

      // Only inject once
      if (!contents.includes('Fix RNScreens compile failure')) {
        contents += POST_INSTALL_SNIPPET;
        fs.writeFileSync(podfilePath, contents);
      }

      return config;
    },
  ]);
};

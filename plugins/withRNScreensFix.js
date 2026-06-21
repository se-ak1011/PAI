/**
 * Expo config plugin that injects Pod build settings into the generated Podfile.
 * This keeps Pod deployment target and C/C++ standards consistent for Xcode 16.
 *
 * Strategy: if the Podfile already has a `post_install` block (typical for
 * Expo-generated Podfiles), inject our settings at the top of that block.
 * Otherwise, append a standalone block at the end of the file.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Lines to inject at the start of an existing post_install block
const INJECT_MARKER = '# PAI pod build settings for Xcode 16 compatibility';
const INJECT_LINES = `  ${INJECT_MARKER}
  # Keep pods aligned with app config (ios.deploymentTarget = 15.1).
  legacy_cxx17_pods = %w[RNScreens]
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'
      # Keep only known legacy pods on C++17; use C++20 elsewhere for RN 0.79 / Expo 53.
      # If a third-party pod fails with C++20, add it to legacy_cxx17_pods.
      config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] =
        legacy_cxx17_pods.include?(target.name) ? 'c++17' : 'c++20'
      config.build_settings['CLANG_CXX_LIBRARY'] = 'libc++'
      config.build_settings['GCC_C_LANGUAGE_STANDARD'] = 'gnu11'
    end
  end
`;

// Standalone block used when there is no existing post_install hook
const STANDALONE_BLOCK = `
${INJECT_MARKER}
post_install do |installer|
${INJECT_LINES}end
`;

/** @type {import('@expo/config-plugins').ConfigPlugin} */
module.exports = function withRNScreensFix(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) return config;

      let contents = fs.readFileSync(podfilePath, 'utf-8');

      // Idempotency guard — skip if already injected
      if (contents.includes(INJECT_MARKER)) return config;

      const existingHook = /^\s*post_install do \|installer\|/m.exec(contents);
      if (existingHook) {
        // Inject our settings right after the opening line of the existing block
        const insertAt = existingHook.index + existingHook[0].length;
        contents = contents.slice(0, insertAt) + '\n' + INJECT_LINES + contents.slice(insertAt);
      } else {
        contents += STANDALONE_BLOCK;
      }

      try {
        fs.writeFileSync(podfilePath, contents);
      } catch (err) {
        throw new Error(`[withRNScreensFix] Failed to write Podfile at ${podfilePath}: ${err.message}`);
      }
      return config;
    },
  ]);
};

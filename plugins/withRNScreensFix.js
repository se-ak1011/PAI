/**
 * Expo config plugin that injects C++ build settings into the generated Podfile.
 * This fixes the RNScreens compile failure on Xcode 16 by ensuring all pod
 * targets use c++17 and libc++ — required by react-native-screens ~4.x.
 *
 * Strategy: if the Podfile already has a `post_install` block (typical for
 * Expo-generated Podfiles), inject our settings at the top of that block.
 * Otherwise, append a standalone block at the end of the file.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Lines to inject at the start of an existing post_install block
const INJECT_MARKER = '# Fix RNScreens / Xcode 16: enforce c++17 + libc++';
const INJECT_LINES = `  ${INJECT_MARKER}
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      # All React-* core pods (RN 0.79+) require C++20 (std::ranges, designated initialisers, etc.)
      # Third-party pods (RNScreens, hermes-engine, Expo*, etc.) stay on c++17
      if target.name =~ /^React-/
        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++20'
      else
        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
      end
      config.build_settings['CLANG_CXX_LIBRARY'] = 'libc++'
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

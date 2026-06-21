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
  # Keep pods aligned with app config (ios.deploymentTarget).
  legacy_cxx17_pods = %w[RNScreens]
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '__IOS_DEPLOYMENT_TARGET__'
      # Keep only known legacy pods on C++17; use C++20 elsewhere for RN 0.79 / Expo 53.
      # If a third-party pod fails with C++20, add it to legacy_cxx17_pods.
      config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] =
        legacy_cxx17_pods.include?(target.name) ? 'c++17' : 'c++20'
      config.build_settings['CLANG_CXX_LIBRARY'] = 'libc++'
      config.build_settings['GCC_C_LANGUAGE_STANDARD'] = 'gnu11'
      config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
      config.build_settings['CODE_SIGNING_REQUIRED'] = 'NO'
      config.build_settings['CODE_SIGNING_IDENTITY'] = ''
    end
  end
`;

/** @type {import('@expo/config-plugins').ConfigPlugin} */
module.exports = function withRNScreensFix(expoConfig) {
  const iosDeploymentTarget = expoConfig?.ios?.deploymentTarget || '15.1';
  const injectLines = INJECT_LINES.replaceAll('__IOS_DEPLOYMENT_TARGET__', iosDeploymentTarget);
  const standaloneBlock = `
${INJECT_MARKER}
post_install do |installer|
${injectLines}end
`;

  return withDangerousMod(expoConfig, [
    'ios',
    (modConfig) => {
      const podfilePath = path.join(modConfig.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) return modConfig;

      let contents = fs.readFileSync(podfilePath, 'utf-8');

      // Idempotency guard — skip if already injected
      if (contents.includes(INJECT_MARKER)) return modConfig;

      const existingHook = /^\s*post_install do \|installer\|/m.exec(contents);
      if (existingHook) {
        // Inject our settings right after the opening line of the existing block
        const insertAt = existingHook.index + existingHook[0].length;
        contents = contents.slice(0, insertAt) + '\n' + injectLines + contents.slice(insertAt);
      } else {
        contents += standaloneBlock;
      }

      try {
        fs.writeFileSync(podfilePath, contents);
      } catch (err) {
        throw new Error(`[withRNScreensFix] Failed to write Podfile at ${podfilePath}: ${err.message}`);
      }
      return modConfig;
    },
  ]);
};

// Lightweight shim to satisfy bare imports of @expo/metro-runtime during web build
try {
  // Load built helpers where available
  require('@expo/metro-runtime/build/async-require');
} catch (e) {}

try {
  require('@expo/metro-runtime/build/error-overlay');
} catch (e) {}

module.exports = {};

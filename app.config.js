const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) return;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

// Extract the values right after loading
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const isExpoGo = process.env.EXPO_GO === '1';
const plugins = [
  ...(isExpoGo ? [] : ['expo-dev-client']),
  'expo-router',
  [
    'expo-splash-screen',
    {
      image: './assets/images/logo.png',
      imageWidth: 200,
      resizeMode: 'contain',
      backgroundColor: '#12171C'
    }
  ],
  'expo-web-browser',
  './plugins/withRNScreensFix',
];

console.log('[app.config.js] Loading env vars:');
console.log('[app.config.js] EXPO_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'SET (' + supabaseUrl.substring(0, 30) + '...)' : 'UNSET');
console.log('[app.config.js] EXPO_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'SET (length: ' + supabaseAnonKey.length + ')' : 'UNSET');

module.exports = {
  expo: {
    name: "PAI",
    slug: "pai",
    owner: "drained-store",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/logo.png",
    scheme: "onspaceapp",
    userInterfaceStyle: "automatic",
    newArchEnabled: false,
    extra: {
      eas: {
        projectId: "edb679df-25ed-42e6-87e7-a027c38860c1"
      },
      // Pass Supabase credentials through extra
      supabaseUrl: supabaseUrl,
      supabaseAnonKey: supabaseAnonKey,
    },
    ios: {
      supportsTablet: true,
      deploymentTarget: "15.1",
      bundleIdentifier: "com.paii.app",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSCalendarsUsageDescription: "This app needs access to your calendar to manage availability and schedule events.",
        NSRemindersUsageDescription: "This app may use reminders to help you stay on top of calendar-related tasks.",
        NSCameraUsageDescription: "This app may use your camera to capture photos or documents when needed.",
        NSMicrophoneUsageDescription: "This app may use your microphone to record audio when capturing video or voice content.",
        NSContactsUsageDescription: "This app may access contacts to help you share profile information and connect with customers.",
        NSLocationWhenInUseUsageDescription: "This app may use your location to help find nearby jobs and contractors.",
        NSPhotoLibraryUsageDescription: "This app may access your photo library to attach images or save shared content.",
        NSPhotoLibraryAddUsageDescription: "This app may save images and documents to your photo library.",
        NSFaceIDUsageDescription: "This app may use Face ID to help keep your account secure.",
        NSMotionUsageDescription: "This app may access motion sensors for activity and location-based features."
      },
      config: {
        usesNonExemptEncryption: false
      }
    },
    android: {
      package: "com.paii.app",
      adaptiveIcon: {
        foregroundImage: "./assets/images/logo.png",
        backgroundColor: "#12171C"
      },
      edgeToEdgeEnabled: true
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/logo.png"
    },
    plugins,
    experiments: {
      typedRoutes: true
    }

  }
};

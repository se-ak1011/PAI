import { useCallback, useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlertProvider } from '@/template/ui';
import { AuthProvider } from '@/contexts/AuthContext';
import { JobsProvider } from '@/contexts/JobsContext';
import { TaxPotProvider } from '@/contexts/TaxPotContext';
import { RoleProvider } from '@/contexts/RoleContext';

const SPLASH_SCREEN_TIMEOUT_MS = 8000;

SplashScreen.preventAutoHideAsync().catch((error) => {
  console.warn('[RootLayout] Failed to prevent splash screen auto-hide:', error);
});

export default function RootLayout() {
  console.log(`[RootLayout] Rendering root layout on ${Platform.OS}`);
  const splashHiddenRef = useRef(false);

  const hideSplashScreen = useCallback(async (reason: string) => {
    if (splashHiddenRef.current) return;
    splashHiddenRef.current = true;

    try {
      await SplashScreen.hideAsync();
      console.log(`[RootLayout] Splash screen hidden (${reason})`);
    } catch (error) {
      console.warn(`[RootLayout] Failed to hide splash screen (${reason}):`, error);
    }
  }, []);

  useEffect(() => {
    console.log('[RootLayout] Startup providers mounted: AlertProvider, SafeAreaProvider, AuthProvider, RoleProvider, JobsProvider, TaxPotProvider');
    const timeoutId = setTimeout(() => {
      hideSplashScreen(`startup timeout ${SPLASH_SCREEN_TIMEOUT_MS}ms`);
    }, SPLASH_SCREEN_TIMEOUT_MS);

    return () => {
      console.log('[RootLayout] Startup providers unmounting');
      clearTimeout(timeoutId);
    };
  }, [hideSplashScreen]);

  return (
    <View style={{ flex: 1 }} onLayout={() => hideSplashScreen('root layout rendered')}>
      <AlertProvider>
        <SafeAreaProvider>
          <AuthProvider>
            <RoleProvider>
              <JobsProvider>
                <TaxPotProvider>
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="index" />
                    <Stack.Screen name="auth" />
                    <Stack.Screen name="onboarding" />
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="job-detail" options={{ headerShown: false }} />
                    <Stack.Screen name="marketplace-job" options={{ headerShown: false }} />
                    <Stack.Screen name="contractor-profile" options={{ headerShown: false }} />
                    <Stack.Screen name="contractor/[id]" options={{ headerShown: false }} />
                    <Stack.Screen name="admin-disputes" options={{ headerShown: false }} />
                    <Stack.Screen name="invoice" options={{ headerShown: false }} />
                  </Stack>
                </TaxPotProvider>
              </JobsProvider>
            </RoleProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </AlertProvider>
    </View>
  );
}

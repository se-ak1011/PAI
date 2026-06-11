import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlertProvider } from '@/template';
import { AuthProvider } from '@/contexts/AuthContext';
import { JobsProvider } from '@/contexts/JobsContext';
import { TaxPotProvider } from '@/contexts/TaxPotContext';
import { RoleProvider } from '@/contexts/RoleContext';

export default function RootLayout() {
  return (
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
                  <Stack.Screen name="admin-disputes" options={{ headerShown: false }} />
                </Stack>
              </TaxPotProvider>
            </JobsProvider>
          </RoleProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </AlertProvider>
  );
}

import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { Colors } from '@/constants/theme';

export default function Index() {
  const { isAuthenticated, isOnboarded, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.primaryGlow} size="large" />
      </View>
    );
  }

  if (!isAuthenticated) return <Redirect href="/auth" />;
  if (!isOnboarded) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}

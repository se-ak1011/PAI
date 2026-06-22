import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { Image } from 'expo-image';
import { useAuth } from '@/hooks/useAuth';
import { Colors } from '@/constants/theme';

export default function Index() {
  const { isAuthenticated, isOnboarded, loading } = useAuth();

  if (loading) {
    // Branded loading screen — a seamless continuation of the splash, so a slow
    // start reads as "loading", not a broken black screen.
    return (
      <View style={styles.splash}>
        <Image
          source={require('@/assets/images/logo.png')}
          style={styles.logo}
          contentFit="contain"
        />
        <ActivityIndicator color={Colors.primaryGlow} size="small" style={styles.spinner} />
      </View>
    );
  }

  if (!isAuthenticated) return <Redirect href="/auth" />;
  if (!isOnboarded) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: '#12171C', alignItems: 'center', justifyContent: 'center' },
  logo: { width: 120, height: 120 },
  spinner: { marginTop: 28 },
});

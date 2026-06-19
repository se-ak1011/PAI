/*
 * @Description: 404 fallback
 */

import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Radius } from '@/constants/theme';

export default function NotFoundScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <MaterialIcons name="report-problem" size={72} color={Colors.primary} />
        <Text style={styles.title}>Page not found</Text>
        <Text style={styles.message}>
          That page doesn’t exist or has been moved.
        </Text>

        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => router.push('/')}
        >
          <Text style={styles.homeButtonText}>Return home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    ...Typography.brandMD,
    marginTop: 20,
    marginBottom: 10,
  },
  message: {
    ...Typography.bodyMD,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 40,
  },
  homeButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: Radius.md,
  },
  homeButtonText: {
    ...Typography.btnMD,
    color: Colors.textInverse,
  },
});

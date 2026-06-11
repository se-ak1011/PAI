import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius, Typography } from '@/constants/theme';

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  compact?: boolean;
}

export function StatCard({ label, value, sub, color = Colors.textPrimary, compact }: StatCardProps) {
  return (
    <View style={[styles.card, compact && styles.compact]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color }]}>{value}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 4,
  },
  compact: { padding: 10 },
  label: { ...Typography.labelXS, color: Colors.textMuted },
  value: { ...Typography.dataLG },
  sub: { ...Typography.labelSM, color: Colors.textMuted },
});

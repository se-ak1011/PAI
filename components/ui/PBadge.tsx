import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius } from '@/constants/theme';

type BadgeVariant = 'active' | 'paid' | 'invoiced' | 'draft' | 'open' | 'in_progress' | 'completed' | 'cancelled' | 'default';

interface PBadgeProps {
  label: string;
  variant?: BadgeVariant;
}

const BADGE_COLORS: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
  active: { bg: Colors.infoDim, text: Colors.info, border: Colors.info },
  paid: { bg: Colors.successDim, text: Colors.success, border: Colors.success },
  invoiced: { bg: Colors.warningDim, text: Colors.warning, border: Colors.warning },
  draft: { bg: Colors.cardAlt, text: Colors.textMuted, border: Colors.border },
  open: { bg: Colors.successDim, text: Colors.success, border: Colors.success },
  in_progress: { bg: Colors.infoDim, text: Colors.info, border: Colors.info },
  completed: { bg: Colors.primaryDim, text: Colors.primaryLight, border: Colors.primary },
  cancelled: { bg: Colors.errorDim, text: Colors.error, border: Colors.error },
  default: { bg: Colors.cardAlt, text: Colors.textSecondary, border: Colors.border },
};

export function PBadge({ label, variant = 'default' }: PBadgeProps) {
  const colors = BADGE_COLORS[variant] || BADGE_COLORS.default;
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.text }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
});

import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { Colors, Radius, Typography } from '@/constants/theme';

interface PButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export function PButton({ label, onPress, variant = 'primary', size = 'md', loading, disabled, style, textStyle, fullWidth }: PButtonProps) {
  const isDisabled = disabled || loading;

  const containerStyle = [
    styles.base,
    styles[variant],
    styles[`size_${size}`],
    fullWidth && styles.fullWidth,
    isDisabled && styles.disabled,
    style,
  ];

  const labelStyle = [
    styles.label,
    styles[`label_${variant}`],
    styles[`labelSize_${size}`],
    textStyle,
  ];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [...containerStyle, pressed && styles.pressed]}
      hitSlop={8}
    >
      {loading
        ? <ActivityIndicator size="small" color={variant === 'primary' ? Colors.textInverse : Colors.primary} />
        : <Text style={labelStyle}>{label}</Text>
      }
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primary: {
    backgroundColor: Colors.primary,
  },
  secondary: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  danger: {
    backgroundColor: Colors.errorDim,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  size_sm: { height: 36, paddingHorizontal: 14 },
  size_md: { height: 48, paddingHorizontal: 20 },
  size_lg: { height: 56, paddingHorizontal: 24 },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  label: { ...Typography.btnMD },
  label_primary: { color: Colors.textInverse },
  label_secondary: { color: Colors.textPrimary },
  label_ghost: { color: Colors.textSecondary },
  label_danger: { color: Colors.error },
  labelSize_sm: { fontSize: 13 },
  labelSize_md: { fontSize: 15 },
  labelSize_lg: { fontSize: 16 },
});

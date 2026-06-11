import React, { ReactNode } from 'react';
import { Pressable, View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Radius, Shadow } from '@/constants/theme';

interface PCardProps {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  variant?: 'default' | 'alt' | 'highlight';
  noPadding?: boolean;
}

export function PCard({ children, onPress, style, variant = 'default', noPadding }: PCardProps) {
  const containerStyle = [
    styles.base,
    styles[variant],
    noPadding ? styles.noPadding : styles.padding,
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [...containerStyle, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={containerStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    ...Shadow.card,
  },
  padding: { padding: 16 },
  noPadding: {},
  default: {
    backgroundColor: Colors.card,
    borderColor: Colors.border,
  },
  alt: {
    backgroundColor: Colors.surfaceAlt,
    borderColor: Colors.borderSubtle,
  },
  highlight: {
    backgroundColor: Colors.primaryDim,
    borderColor: Colors.primary,
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
});

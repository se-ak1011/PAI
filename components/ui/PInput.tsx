import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { Colors, Radius, Typography } from '@/constants/theme';

interface PInputProps extends TextInputProps {
  label?: string;
  error?: string;
  prefix?: string;
  suffix?: string;
}

export function PInput({ label, error, prefix, suffix, style, ...props }: PInputProps) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputRow, error ? styles.inputError : null]}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={Colors.textMuted}
          selectionColor={Colors.primary}
          {...props}
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: {
    ...Typography.labelSM,
    color: Colors.textSecondary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    height: 48,
  },
  inputError: { borderColor: Colors.error },
  input: {
    flex: 1,
    ...Typography.bodyMD,
    color: Colors.textPrimary,
  },
  prefix: { ...Typography.bodyMD, color: Colors.textMuted, marginRight: 6 },
  suffix: { ...Typography.bodyMD, color: Colors.textMuted, marginLeft: 6 },
  errorText: { ...Typography.labelSM, color: Colors.error },
});

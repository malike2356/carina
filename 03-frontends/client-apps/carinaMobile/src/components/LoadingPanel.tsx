import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/theme/tokens';

interface LoadingPanelProps {
  label?: string;
}

export function LoadingPanel({ label }: LoadingPanelProps) {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={colors.tealLight} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  label: {
    color: colors.silver,
    fontSize: 13,
  },
});

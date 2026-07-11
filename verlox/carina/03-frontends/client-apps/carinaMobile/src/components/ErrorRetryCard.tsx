import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '@/theme/tokens';

interface ErrorRetryCardProps {
  message: string;
  onRetry: () => void;
  retryLabel?: string;
}

export function ErrorRetryCard({
  message,
  onRetry,
  retryLabel = 'Retry',
}: ErrorRetryCardProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.message}>{message}</Text>
      <Pressable
        style={styles.retryBtn}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={retryLabel}
      >
        <Text style={styles.retryText}>{retryLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  message: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  retryText: {
    color: colors.tealLight,
    fontSize: 14,
    fontWeight: '600',
  },
});

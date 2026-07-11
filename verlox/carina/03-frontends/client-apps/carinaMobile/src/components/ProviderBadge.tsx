import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radii, spacing } from '@/theme/tokens';

interface ProviderBadgeProps {
  label: string;
  loading?: boolean;
  onPress?: () => void;
}

export function ProviderBadge({ label, loading, onPress }: ProviderBadgeProps) {
  return (
    <Pressable
      style={styles.badge}
      onPress={onPress}
      disabled={!onPress || loading}
    >
      <Text style={styles.text}>{loading ? '...' : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: colors.inkLift,
    borderWidth: 1,
    borderColor: colors.borderDim,
  },
  text: {
    color: colors.silver,
    fontSize: 12,
    fontWeight: '500',
  },
});

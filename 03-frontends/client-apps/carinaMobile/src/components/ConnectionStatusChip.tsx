import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ConnectionStatus } from '@/lib/connection-test';
import { colors, radii, spacing } from '@/theme/tokens';

interface ConnectionStatusChipProps {
  status: ConnectionStatus;
  onPress?: () => void;
}

const LABELS: Record<ConnectionStatus, string> = {
  online: 'Online',
  offline: 'Offline',
  'auth-error': 'Auth',
  checking: 'Checking',
};

const DOT_COLORS: Record<ConnectionStatus, string> = {
  online: colors.success,
  offline: colors.danger,
  'auth-error': colors.amber,
  checking: colors.silverMid,
};

export function ConnectionStatusChip({ status, onPress }: ConnectionStatusChipProps) {
  const label = `Gateway ${LABELS[status]}`;
  const body = (
    <>
      <View style={[styles.dot, { backgroundColor: DOT_COLORS[status] }]} />
      <Text style={styles.label}>{LABELS[status]}</Text>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        style={styles.chip}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Opens gateway settings"
      >
        {body}
      </Pressable>
    );
  }

  return (
    <View style={styles.chip} accessibilityLabel={label}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.inkLift,
    borderWidth: 1,
    borderColor: colors.borderDim,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    color: colors.silver,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});

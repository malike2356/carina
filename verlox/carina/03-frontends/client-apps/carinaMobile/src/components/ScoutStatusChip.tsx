import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '@/theme/tokens';

export type ScoutStatus = 'unknown' | 'active' | 'inactive' | 'alert';

interface ScoutStatusChipProps {
  status: ScoutStatus;
}

const LABELS: Record<ScoutStatus, string> = {
  unknown: 'Scout',
  active: 'Scout live',
  inactive: 'Scout off',
  alert: 'Scout alert',
};

const DOT_COLORS: Record<ScoutStatus, string> = {
  unknown: colors.silverMid,
  active: colors.success,
  inactive: colors.silverMid,
  alert: colors.amber,
};

export function ScoutStatusChip({ status }: ScoutStatusChipProps) {
  return (
    <View style={styles.chip}>
      <View style={[styles.dot, { backgroundColor: DOT_COLORS[status] }]} />
      <Text style={styles.label}>{LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(245, 166, 35, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.22)',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    color: colors.amber,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});

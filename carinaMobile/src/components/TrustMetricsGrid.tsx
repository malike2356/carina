import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { PublicTrustPayload } from '@/api/types';
import { colors, radii, spacing } from '@/theme/tokens';

interface TrustMetricsGridProps {
  trust: PublicTrustPayload | null;
}

type MetricItem =
  | { source: 'metrics'; key: keyof PublicTrustPayload['metrics']; label: string }
  | { source: 'monitoring'; key: keyof PublicTrustPayload['monitoring']; label: string };

const METRIC_ITEMS: MetricItem[] = [
  { source: 'metrics', key: 'injection_blocks_24h', label: 'Injection blocks (24h)' },
  { source: 'metrics', key: 'runtime_incidents_30d', label: 'Runtime incidents (30d)' },
  { source: 'metrics', key: 'events_today', label: 'Events today' },
  { source: 'metrics', key: 'threats_24h', label: 'Threats (24h)' },
  { source: 'metrics', key: 'blocked_24h', label: 'Blocked (24h)' },
  { source: 'monitoring', key: 'agents_protected', label: 'Agents protected' },
];

export function TrustMetricsGrid({ trust }: TrustMetricsGridProps) {
  return (
    <View style={styles.grid}>
      {METRIC_ITEMS.map((item) => {
        const value =
          item.source === 'monitoring'
            ? trust?.monitoring?.[item.key]
            : trust?.metrics?.[item.key];
        return (
          <View key={item.label} style={styles.cell}>
            <Text style={styles.value}>{value ?? 0}</Text>
            <Text style={styles.label}>{item.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  cell: {
    width: '48%',
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.md,
    padding: spacing.md,
    backgroundColor: colors.inkMid,
    gap: 4,
  },
  value: {
    color: colors.tealLight,
    fontSize: 22,
    fontWeight: '600',
  },
  label: {
    color: colors.silver,
    fontSize: 11,
    lineHeight: 15,
  },
});

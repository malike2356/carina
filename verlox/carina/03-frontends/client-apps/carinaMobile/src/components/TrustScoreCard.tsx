import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { PublicTrustPayload } from '@/api/types';
import { riskTierColor } from '@/lib/trust-theme';
import { colors, radii, spacing } from '@/theme/tokens';

interface TrustScoreCardProps {
  trust: PublicTrustPayload | null;
  loading?: boolean;
}

export function TrustScoreCard({ trust, loading }: TrustScoreCardProps) {
  const score = trust?.risk_score;
  const tier = trust?.risk_tier;
  const color = riskTierColor(tier);

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Risk score</Text>
      <Text style={[styles.score, { color }]}>
        {loading && score == null ? '--' : String(score ?? '--')}
      </Text>
      <Text style={[styles.tier, { color, borderColor: color }]}>
        {trust?.risk_tier_label ?? (loading ? 'Loading...' : 'Unavailable')}
      </Text>
      <Text style={styles.meta}>
        Scout: {trust?.monitoring?.scout_active ? 'Active' : 'Idle'}
        {trust?.monitoring?.last_scan_relative
          ? ` · ${trust.monitoring.last_scan_relative}`
          : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
    backgroundColor: colors.inkMid,
    gap: spacing.sm,
  },
  label: {
    color: colors.amber,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  score: {
    fontSize: 52,
    fontWeight: '600',
  },
  tier: {
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    overflow: 'hidden',
  },
  meta: {
    color: colors.silver,
    fontSize: 13,
    textAlign: 'center',
  },
});

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ScoutSecurityEvent } from '@/api/types';
import { severityColor } from '@/lib/trust-theme';
import { colors, radii, spacing } from '@/theme/tokens';

interface SecurityEventCardProps {
  event: ScoutSecurityEvent;
}

export function SecurityEventCard({ event }: SecurityEventCardProps) {
  const color = severityColor(event.severity);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={[styles.severity, { color }]}>{event.severity}</Text>
        <Text style={styles.time}>
          {new Date(event.created_at).toLocaleString()}
        </Text>
      </View>
      <Text style={styles.type}>{event.event_type}</Text>
      <Text style={styles.description}>{event.description}</Text>
      {event.instance_id ? (
        <Text style={styles.instance}>Instance: {event.instance_id}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.md,
    padding: spacing.md,
    backgroundColor: colors.inkMid,
    gap: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  severity: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  time: {
    color: colors.silverMid,
    fontSize: 10,
  },
  type: {
    color: colors.amber,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  description: {
    color: colors.offWhite,
    fontSize: 13,
    lineHeight: 18,
  },
  instance: {
    color: colors.silverMid,
    fontSize: 11,
  },
});

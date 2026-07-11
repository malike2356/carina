import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '@/theme/tokens';

interface OfflineQueueBannerProps {
  count: number;
  flushing?: boolean;
  onFlush?: () => void;
}

export function OfflineQueueBanner({ count, flushing, onFlush }: OfflineQueueBannerProps) {
  if (count === 0) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        {flushing ? 'Sending queued messages...' : `${count} message${count === 1 ? '' : 's'} queued offline`}
      </Text>
      {!flushing && onFlush ? (
        <Pressable style={styles.actionBtn} onPress={onFlush} accessibilityRole="button">
          <Text style={styles.action}>Retry now</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(245, 166, 35, 0.12)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(245, 166, 35, 0.25)',
  },
  text: {
    color: colors.amber,
    fontSize: 12,
    flex: 1,
  },
  action: {
    color: colors.tealLight,
    fontSize: 12,
    fontWeight: '600',
  },
  actionBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
});

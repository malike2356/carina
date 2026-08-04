import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PackMeta } from '@/api/types';
import { colors, radii, spacing } from '@/theme/tokens';

interface PackCardProps {
  pack: PackMeta;
  installed: boolean;
  busy?: boolean;
  onInstall: () => void;
  onUninstall: () => void;
}

export function PackCard({ pack, installed, busy, onInstall, onUninstall }: PackCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.name}>{pack.name}</Text>
      <Text style={styles.description}>{pack.description || 'No description'}</Text>
      <Text style={styles.meta}>
        v{pack.version} · {pack.skill_count} skills · {pack.author}
      </Text>
      <Pressable
        style={[styles.action, installed ? styles.uninstall : styles.install]}
        onPress={installed ? onUninstall : onInstall}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color={colors.white} size="small" />
        ) : (
          <Text style={styles.actionText}>{installed ? 'Uninstall' : 'Install'}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.lg,
    padding: spacing.md,
    backgroundColor: colors.inkMid,
    gap: spacing.xs,
  },
  name: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  description: {
    color: colors.silver,
    fontSize: 13,
    lineHeight: 18,
  },
  meta: {
    color: colors.silverMid,
    fontSize: 11,
  },
  action: {
    marginTop: spacing.sm,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  install: {
    backgroundColor: colors.teal,
  },
  uninstall: {
    backgroundColor: colors.inkLift,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 13,
  },
});

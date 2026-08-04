import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AivaWorkerListItem } from '@/lib/aiva-home';
import { colors, radii, spacing } from '@/theme/tokens';

interface AivaWorkerRowProps {
  worker: AivaWorkerListItem;
  onPress: () => void;
}

function roleTitle(description: string): string {
  const trimmed = description.trim();
  if (!trimmed) return 'AI worker';
  const first = trimmed.split(/[.!?\n]/)[0]?.trim() || trimmed;
  return first.length > 64 ? `${first.slice(0, 64)}...` : first;
}

export function AivaWorkerRow({
  worker,
  onPress,
}: AivaWorkerRowProps) {
  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${worker.name}`}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{worker.name.slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.name}>{worker.name}</Text>
        <Text style={styles.role} numberOfLines={1}>
          {roleTitle(worker.roleDescription)}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {worker.statusLabel}
          {worker.channelCount > 0
            ? ` · ${worker.channelCount} channel${worker.channelCount === 1 ? '' : 's'}`
            : ' · No channels yet'}
          {worker.lastActiveLabel ? ` · ${worker.lastActiveLabel}` : ''}
        </Text>
      </View>
      <Text style={styles.chevron}>Open</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.lg,
    backgroundColor: colors.inkMid,
    minHeight: 72,
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.inkLift,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.tealLight,
    fontSize: 18,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  name: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  meta: {
    color: colors.silverMid,
    fontSize: 12,
  },
  role: {
    color: colors.silver,
    fontSize: 13,
    lineHeight: 18,
  },
  chevron: {
    color: colors.tealLight,
    fontSize: 13,
    fontWeight: '600',
  },
});

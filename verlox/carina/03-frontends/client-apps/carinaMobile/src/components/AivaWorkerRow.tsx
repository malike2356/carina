import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AivaWorkerListItem } from '@/lib/aiva-home';
import { colors, radii, spacing } from '@/theme/tokens';

interface AivaWorkerRowProps {
  worker: AivaWorkerListItem;
  onPress: () => void;
  onChatPress?: () => void;
  onSettingsPress?: () => void;
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
  onChatPress,
  onSettingsPress,
}: AivaWorkerRowProps) {
  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open chat with ${worker.name}`}
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
            ? ` · ${worker.channelCount} tool${worker.channelCount === 1 ? '' : 's'}`
            : ' · No tools yet'}
          {worker.lastActiveLabel ? ` · ${worker.lastActiveLabel}` : ''}
        </Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          style={styles.actionBtn}
          onPress={(event) => {
            event.stopPropagation?.();
            (onChatPress ?? onPress)();
          }}
          accessibilityRole="button"
          accessibilityLabel={`Chat with ${worker.name}`}
        >
          <Text style={styles.actionText}>Chat</Text>
        </Pressable>
        {onSettingsPress ? (
          <Pressable
            style={styles.actionBtnGhost}
            onPress={(event) => {
              event.stopPropagation?.();
              onSettingsPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={`Settings for ${worker.name}`}
          >
            <Text style={styles.actionTextGhost}>Settings</Text>
          </Pressable>
        ) : null}
      </View>
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
  actions: {
    gap: 6,
    alignItems: 'stretch',
  },
  actionBtn: {
    minHeight: 32,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnGhost: {
    minHeight: 28,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextGhost: {
    color: colors.tealLight,
    fontSize: 12,
    fontWeight: '600',
  },
});

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AgentTask } from '@/api/types';
import { colors, radii, spacing } from '@/theme/tokens';

interface TaskCardProps {
  task: AgentTask;
  onOpenSession?: (sessionId: string) => void;
}

const STATUS_COLORS: Record<AgentTask['status'], string> = {
  running: colors.amber,
  completed: colors.success,
  failed: colors.danger,
};

export function TaskCard({ task, onOpenSession }: TaskCardProps) {
  const canOpen = Boolean(onOpenSession && task.sessionId && task.sessionId !== 'pending');

  return (
    <Pressable
      style={styles.card}
      onPress={canOpen ? () => onOpenSession?.(task.sessionId) : undefined}
      disabled={!canOpen}
      accessibilityRole="button"
      accessibilityLabel={`Task ${task.status}: ${task.prompt}`}
      accessibilityHint={canOpen ? 'Opens the related conversation' : undefined}
    >
      <View style={styles.header}>
        <Text style={[styles.status, { color: STATUS_COLORS[task.status] }]}>
          {task.status}
        </Text>
        <Text style={styles.time}>
          {new Date(task.startedAt).toLocaleString()}
        </Text>
      </View>
      <Text style={styles.prompt} numberOfLines={2}>
        {task.prompt}
      </Text>
      {task.summary ? (
        <Text style={styles.summary} numberOfLines={3}>
          {task.summary}
        </Text>
      ) : null}
      {task.toolsUsed && task.toolsUsed.length > 0 ? (
        <View style={styles.toolRow}>
          {task.toolsUsed.map((tool) => (
            <Text key={tool} style={styles.toolBadge}>{tool}</Text>
          ))}
        </View>
      ) : null}
      {canOpen ? <Text style={styles.openHint}>View conversation</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.inkMid,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  status: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  time: {
    color: colors.silverMid,
    fontSize: 11,
  },
  prompt: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '500',
  },
  summary: {
    color: colors.silver,
    fontSize: 13,
    lineHeight: 18,
  },
  toolRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  toolBadge: {
    color: colors.tealLight,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
    backgroundColor: 'rgba(94, 234, 212, 0.1)',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  openHint: {
    color: colors.tealLight,
    fontSize: 11,
    fontWeight: '600',
  },
});

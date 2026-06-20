import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { EpisodicMemory } from '@/api/types';
import { colors, radii, spacing } from '@/theme/tokens';

interface MemoryCardProps {
  memory: EpisodicMemory;
  onEdit: (memory: EpisodicMemory) => void;
  onDelete: (id: string) => void;
}

export function MemoryCard({ memory, onEdit, onDelete }: MemoryCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.category}>{memory.category}</Text>
        <View style={styles.actions}>
          <Pressable onPress={() => onEdit(memory)}>
            <Text style={styles.edit}>Edit</Text>
          </Pressable>
          <Pressable onPress={() => onDelete(memory.id)}>
            <Text style={styles.delete}>Delete</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.content}>{memory.content}</Text>
      <Text style={styles.meta}>
        Priority {memory.priority} · {new Date(memory.updated_at).toLocaleString()}
      </Text>
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
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  edit: {
    color: colors.tealLight,
    fontSize: 12,
    fontWeight: '600',
  },
  category: {
    color: colors.tealLight,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  delete: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    color: colors.offWhite,
    fontSize: 14,
    lineHeight: 20,
  },
  meta: {
    color: colors.silverMid,
    fontSize: 11,
  },
});

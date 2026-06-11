import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SlashCommand } from '@/config/commands';
import { colors, radii, spacing } from '@/theme/tokens';

interface CommandPaletteProps {
  commands: SlashCommand[];
  onSelect: (command: string) => void;
}

export function CommandPalette({ commands, onSelect }: CommandPaletteProps) {
  if (commands.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {commands.map((item) => (
        <Pressable key={item.command} style={styles.row} onPress={() => onSelect(item.command)}>
          <Text style={styles.command}>{item.command}</Text>
          <Text style={styles.description}>{item.description}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    borderTopColor: colors.borderDim,
    backgroundColor: colors.inkLift,
    maxHeight: 220,
  },
  row: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDim,
    gap: 2,
  },
  command: {
    color: colors.tealLight,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  description: {
    color: colors.silver,
    fontSize: 12,
  },
});

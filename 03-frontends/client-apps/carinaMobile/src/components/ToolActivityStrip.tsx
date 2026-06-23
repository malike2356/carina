import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '@/theme/tokens';

interface ToolActivityStripProps {
  tools: string[];
}

export function ToolActivityStrip({ tools }: ToolActivityStripProps) {
  if (tools.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Tools</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {tools.map((tool) => (
          <View key={tool} style={styles.chip}>
            <Text style={styles.chipText}>{tool}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    borderTopColor: colors.borderDim,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    backgroundColor: colors.inkMid,
  },
  label: {
    color: colors.amber,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  row: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: 'rgba(26, 95, 122, 0.15)',
  },
  chipText: {
    color: colors.tealLight,
    fontSize: 12,
    fontWeight: '500',
  },
});

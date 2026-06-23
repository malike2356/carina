import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SUGGESTED_PROMPTS } from '@/config/defaults';
import { colors, radii, spacing } from '@/theme/tokens';

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

export function SuggestedPrompts({ onSelect, disabled }: SuggestedPromptsProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>What should I work on?</Text>
      <Text style={styles.subtitle}>General-purpose agent. Tap a starter or type below.</Text>
      {SUGGESTED_PROMPTS.map((prompt) => (
        <Pressable
          key={prompt}
          style={[styles.chip, disabled && styles.chipDisabled]}
          onPress={() => onSelect(prompt)}
          disabled={disabled}
        >
          <Text style={styles.chipText}>{prompt}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    fontFamily: 'Georgia',
    fontSize: 24,
    color: colors.white,
    fontWeight: '500',
  },
  subtitle: {
    color: colors.silver,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    backgroundColor: colors.inkMid,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  chipText: {
    color: colors.offWhite,
    fontSize: 14,
    lineHeight: 20,
  },
});

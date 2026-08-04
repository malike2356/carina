import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { LocalModelManager } from '@/components/LocalModelManager';
import { ScreenShell } from '@/components/ScreenShell';
import { colors, spacing } from '@/theme/tokens';

export default function LocalModelScreen() {
  return (
    <ScreenShell
      title="Mini models"
      subtitle="Install Llama 1B, Qwen 1.5B, and/or Gemma 2B for offline chat when Cloud is unreachable."
    >
      <Pressable style={styles.back} onPress={() => router.back()} accessibilityRole="button">
        <Text style={styles.backText}>Back to More</Text>
      </Pressable>
      <LocalModelManager />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  back: {
    minHeight: 44,
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  backText: {
    color: colors.tealLight,
    fontSize: 14,
  },
});

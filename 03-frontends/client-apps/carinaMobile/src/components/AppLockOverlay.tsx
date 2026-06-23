import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '@/theme/tokens';

interface AppLockOverlayProps {
  visible: boolean;
  onUnlock: () => void;
}

export function AppLockOverlay({ visible, onUnlock }: AppLockOverlayProps) {
  return (
    <Modal visible={visible} animationType="fade" transparent={false}>
      <View style={styles.container}>
        <Text style={styles.title}>Carina is locked</Text>
        <Text style={styles.subtitle}>Authenticate to continue</Text>
        <Pressable style={styles.button} onPress={onUnlock}>
          <Text style={styles.buttonText}>Unlock</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    color: colors.white,
    fontSize: 24,
    fontWeight: '600',
    fontFamily: 'Georgia',
  },
  subtitle: {
    color: colors.silver,
    fontSize: 15,
  },
  button: {
    marginTop: spacing.lg,
    backgroundColor: colors.teal,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  buttonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
});

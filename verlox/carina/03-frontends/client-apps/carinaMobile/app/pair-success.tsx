import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenShell } from '@/components/ScreenShell';
import { PAIRING_SCOPE_LABELS } from '@/api/pairing';
import { colors, radii, spacing } from '@/theme/tokens';

export default function PairSuccessScreen() {
  const params = useLocalSearchParams<{ scopes?: string }>();
  const scopes = (params.scopes ?? 'chat,control')
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);

  return (
    <ScreenShell
      title="Connected"
      subtitle="This device is paired with your Carina agent."
      scroll={false}
    >
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Device paired</Text>
        <Text style={styles.heroMeta}>
          Carina can now authenticate this device for companion features.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Granted permissions</Text>
        {scopes.map((scope) => (
          <Text key={scope} style={styles.scopeItem}>
            + {PAIRING_SCOPE_LABELS[scope] ?? scope}
          </Text>
        ))}
      </View>

      <Pressable style={styles.button} onPress={() => router.replace('/(tabs)/chat')}>
        <Text style={styles.buttonText}>Start using Carina</Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={() => router.replace('/paired-devices')}>
        <Text style={styles.secondaryButtonText}>View paired devices</Text>
      </Pressable>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  heroTitle: {
    color: colors.white,
    fontSize: 24,
    fontWeight: '700',
  },
  heroMeta: {
    color: colors.silver,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.inkMid,
    marginBottom: spacing.lg,
  },
  label: {
    color: colors.amber,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  scopeItem: {
    color: colors.tealLight,
    fontSize: 14,
  },
  button: {
    backgroundColor: colors.teal,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.white,
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: spacing.md,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  secondaryButtonText: {
    color: colors.tealLight,
    fontWeight: '600',
  },
});

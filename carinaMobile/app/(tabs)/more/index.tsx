import { router } from 'expo-router';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { ScreenShell } from '@/components/ScreenShell';
import { useAppLock } from '@/hooks/useAppLock';
import { useNotificationPrefs } from '@/hooks/useNotificationPrefs';
import { useAuth } from '@/store/auth-store';
import { colors, radii, spacing } from '@/theme/tokens';

export default function MoreScreen() {
  const { instance, user, signOut } = useAuth();
  const {
    taskEnabled,
    scoutEnabled,
    remoteEnabled,
    toggleTasks,
    toggleScout,
    toggleRemote,
  } = useNotificationPrefs();
  const { enabled: biometricEnabled, available: biometricAvailable, toggle: toggleBiometric } =
    useAppLock();

  const cloudUser = instance?.mode === 'cloud' && user;

  return (
    <ScreenShell title="More" subtitle="Settings, memory, packs, and security.">
      <View style={styles.card}>
        <Text style={styles.label}>Workspace</Text>
        <Pressable style={styles.linkRow} onPress={() => router.push('/memory')}>
          <Text style={styles.linkText}>Memory browser</Text>
          <Text style={styles.linkMeta}>View, edit, and delete episodic memories</Text>
        </Pressable>
        <Pressable style={styles.linkRow} onPress={() => router.push('/packs')}>
          <Text style={styles.linkText}>Skill packs</Text>
          <Text style={styles.linkMeta}>Install optional packs (not property-uk)</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Notifications</Text>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.value}>Task finished (local)</Text>
            <Text style={styles.meta}>Alert when a task completes while the app is backgrounded.</Text>
          </View>
          <Switch
            value={taskEnabled}
            onValueChange={(next) => void toggleTasks(next)}
            trackColor={{ false: colors.inkLift, true: colors.teal }}
            thumbColor={colors.white}
          />
        </View>
        {cloudUser ? (
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.value}>Remote push (tasks)</Text>
              <Text style={styles.meta}>
                Carina Cloud sends APNs/FCM when a stream finishes and the app was killed.
              </Text>
            </View>
            <Switch
              value={remoteEnabled}
              onValueChange={(next) => void toggleRemote(next)}
              trackColor={{ false: colors.inkLift, true: colors.teal }}
              thumbColor={colors.white}
            />
          </View>
        ) : null}
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.value}>Scout security alerts</Text>
            <Text style={styles.meta}>
              Warning and critical Scout events; remote when signed into Carina Cloud.
            </Text>
          </View>
          <Switch
            value={scoutEnabled}
            onValueChange={(next) => void toggleScout(next)}
            trackColor={{ false: colors.inkLift, true: colors.teal }}
            thumbColor={colors.white}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Security</Text>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.value}>Biometric app lock</Text>
            <Text style={styles.meta}>
              {biometricAvailable
                ? 'Require Face ID / fingerprint after backgrounding.'
                : 'Not available on this device.'}
            </Text>
          </View>
          <Switch
            value={biometricEnabled}
            onValueChange={(next) => void toggleBiometric(next)}
            disabled={!biometricAvailable}
            trackColor={{ false: colors.inkLift, true: colors.teal }}
            thumbColor={colors.white}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Gateway</Text>
        <Pressable style={styles.linkRow} onPress={() => router.push('/instance')}>
          <Text style={styles.linkText}>Instance settings</Text>
          <Text style={styles.linkMeta}>
            {instance?.baseUrl ?? 'Not configured'} · {instance?.mode ?? 'unknown'}
          </Text>
        </Pressable>
      </View>

      {cloudUser ? (
        <View style={styles.card}>
          <Text style={styles.label}>Carina Cloud</Text>
          <Pressable style={styles.linkRow} onPress={() => router.push('/usage')}>
            <Text style={styles.linkText}>Usage and billing</Text>
            <Text style={styles.linkMeta}>Token usage, plan, and Stripe portal</Text>
          </Pressable>
        </View>
      ) : null}

      {user ? (
        <View style={styles.card}>
          <Text style={styles.label}>Account</Text>
          <Text style={styles.value}>{user.email}</Text>
          <Text style={styles.meta}>Tier: {user.tier}</Text>
        </View>
      ) : null}

      <Text style={styles.signOut} onPress={() => void signOut()}>
        Sign out
      </Text>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.inkMid,
  },
  label: {
    color: colors.amber,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  rowText: {
    flex: 1,
    gap: spacing.xs,
  },
  linkRow: {
    paddingVertical: spacing.sm,
    gap: 2,
  },
  linkText: {
    color: colors.tealLight,
    fontSize: 15,
    fontWeight: '600',
  },
  linkMeta: {
    color: colors.silverMid,
    fontSize: 12,
  },
  value: {
    color: colors.white,
    fontSize: 15,
  },
  meta: {
    color: colors.silver,
    fontSize: 13,
    lineHeight: 18,
  },
  signOut: {
    color: colors.tealLight,
    fontSize: 15,
    marginTop: spacing.md,
  },
});

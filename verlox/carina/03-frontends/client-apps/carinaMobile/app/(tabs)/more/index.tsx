import { router, type Href } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { ScreenShell } from '@/components/ScreenShell';
import { useAppLock } from '@/hooks/useAppLock';
import { useCloudFeatureAccess } from '@/hooks/useCloudFeatureAccess';
import { useNativeCapabilities } from '@/hooks/useNativeCapabilities';
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
  const memoryAccess = useCloudFeatureAccess('memory');
  const packsAccess = useCloudFeatureAccess('packs');
  const native = useNativeCapabilities();

  const handleSignOut = useCallback(async () => {
    await signOut();
    if (instance?.mode === 'cloud') {
      router.replace('/(auth)/login');
      return;
    }
    router.replace('/(auth)/onboarding');
  }, [instance?.mode, signOut]);

  return (
    <ScreenShell title="More" subtitle="Settings, memory, packs, and security.">
      <View style={styles.card}>
        <Text style={styles.label}>Workspace</Text>
        <Pressable
          style={[styles.linkRow, !memoryAccess.available && styles.linkRowDisabled]}
          onPress={() => memoryAccess.available && router.push('/memory')}
          disabled={!memoryAccess.available}
        >
          <Text style={[styles.linkText, !memoryAccess.available && styles.linkTextDisabled]}>
            Memory browser
          </Text>
          <Text style={styles.linkMeta}>
            {memoryAccess.available
              ? 'View, edit, and delete episodic memories'
              : memoryAccess.reason}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.linkRow, !packsAccess.available && styles.linkRowDisabled]}
          onPress={() => packsAccess.available && router.push('/packs')}
          disabled={!packsAccess.available}
        >
          <Text style={[styles.linkText, !packsAccess.available && styles.linkTextDisabled]}>
            Skill packs
          </Text>
          <Text style={styles.linkMeta}>
            {packsAccess.available
              ? 'Install optional packs (not property-uk)'
              : packsAccess.reason}
          </Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Mini models</Text>
        <Pressable
          style={styles.linkRow}
          onPress={() => router.push('/local-model' as Href)}
        >
          <Text style={styles.linkText}>On-device mini LLMs</Text>
          <Text style={styles.linkMeta}>
            Llama 1B · Qwen 1.5B · Gemma 2B for offline chat
          </Text>
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
                {native.remotePush.available
                  ? 'Carina Cloud sends APNs/FCM when a stream finishes and the app was killed.'
                  : native.remotePush.reason}
              </Text>
            </View>
            <Switch
              value={remoteEnabled}
              onValueChange={(next) => void toggleRemote(next)}
              disabled={!native.remotePush.available}
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
        <Text style={styles.label}>Device features</Text>
        <Text style={styles.meta}>
          {native.expoGo
            ? 'Running in Expo Go. Voice, remote push, and the Android widget need an EAS development or store build.'
            : 'Native features are enabled for this build profile.'}
        </Text>
        <Pressable style={styles.linkRow} onPress={() => router.push('/voice-wake')}>
          <Text style={styles.linkText}>Voice wake</Text>
          <Text style={styles.linkMeta}>
            Say "Hey Carina" hands-free; on-device listening with privacy hours.
          </Text>
        </Pressable>
        <Pressable style={styles.linkRow} onPress={() => router.push('/voice-settings')}>
          <Text style={styles.linkText}>Voice settings</Text>
          <Text style={styles.linkMeta}>Toggle wake phrase and view privacy window.</Text>
        </Pressable>
        {!native.voice.available ? (
          <Text style={styles.meta}>Voice: {native.voice.reason}</Text>
        ) : null}
        {!native.widget.available && native.widget.reason ? (
          <Text style={styles.meta}>Widget: {native.widget.reason}</Text>
        ) : native.widget.available ? (
          <Text style={styles.meta}>
            Widget: After installing a preview or production build, open the Android launcher,
            choose Widgets, and add Carina tasks.
          </Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Security</Text>
        <Pressable style={styles.linkRow} onPress={() => router.push('/privacy-relay')}>
          <Text style={styles.linkText}>Message relay</Text>
          <Text style={styles.linkMeta}>
            Opt-in SMS, call, and notification forwarding with privacy controls.
          </Text>
        </Pressable>
        <Pressable style={styles.linkRow} onPress={() => router.push('/paired-devices')}>
          <Text style={styles.linkText}>Paired devices</Text>
          <Text style={styles.linkMeta}>
            Scan a desktop QR code and manage companion device access.
          </Text>
        </Pressable>
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

      {cloudUser ? (
        <Pressable
          style={styles.signOutBtn}
          onPress={() => void handleSignOut()}
          accessibilityRole="button"
          accessibilityLabel="Sign out of Carina Cloud"
        >
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      ) : null}
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
  linkRowDisabled: {
    opacity: 0.55,
  },
  linkTextDisabled: {
    color: colors.silverMid,
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
  },
  signOutBtn: {
    minHeight: 44,
    justifyContent: 'center',
    marginTop: spacing.md,
  },
});

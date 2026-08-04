import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  dismissAivaWorker,
  getAivaWorker,
  patchAivaWorker,
  type AivaWorkerDetail,
} from '@/api/aiva-client';
import { AivaEmployeeSectionNav } from '@/components/AivaEmployeeSectionNav';
import { CloudFeatureGate } from '@/components/CloudFeatureGate';
import { ErrorRetryCard } from '@/components/ErrorRetryCard';
import { LoadingPanel } from '@/components/LoadingPanel';
import { ScreenShell } from '@/components/ScreenShell';
import { useAuth } from '@/store/auth-store';
import { colors, radii, spacing } from '@/theme/tokens';

function EmployeeSettings({ workerId }: { workerId: string }) {
  const { instance, gatewayAuth } = useAuth();
  const [worker, setWorker] = useState<AivaWorkerDetail | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!instance?.baseUrl || !gatewayAuth?.apiKey) {
      setError('Sign in to Carina Cloud to manage this employee.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const detail = await getAivaWorker(instance.baseUrl, workerId, gatewayAuth);
      setWorker(detail);
      setName(detail.name);
      setRole(detail.roleDescription);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [gatewayAuth, instance?.baseUrl, workerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async () => {
    const roleName = name.trim();
    const roleDescription = role.trim();
    if (
      !roleName
      || !roleDescription
      || !worker
      || !instance?.baseUrl
      || !gatewayAuth?.apiKey
      || busy
    ) {
      if (!roleName || !roleDescription) setError('Name and role description are required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await patchAivaWorker(
        instance.baseUrl,
        worker.id,
        { roleName, roleDescription },
        gatewayAuth,
      );
      setWorker(updated);
      setName(updated.name);
      setRole(updated.roleDescription);
      Alert.alert('Saved', 'Employee details updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [busy, gatewayAuth, instance?.baseUrl, name, role, worker]);

  const confirmDismiss = useCallback(() => {
    if (!worker || !instance?.baseUrl || !gatewayAuth?.apiKey || busy) return;
    Alert.alert(
      'Dismiss employee?',
      `${worker.name} will be removed from your workspace. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Dismiss',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true);
              setError(null);
              try {
                await dismissAivaWorker(instance.baseUrl, worker.id, gatewayAuth);
                router.replace('/(tabs)/employees' as Href);
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  }, [busy, gatewayAuth, instance?.baseUrl, worker]);

  if (loading) return <LoadingPanel label="Loading settings" />;
  if (error && !worker) {
    return <ErrorRetryCard message={error} onRetry={() => void load()} />;
  }
  if (!worker) {
    return <ErrorRetryCard message="Employee not found." onRetry={() => router.back()} />;
  }

  return (
    <View style={styles.block}>
      <AivaEmployeeSectionNav workerId={worker.id} active="settings" />

      <View style={styles.card}>
        <Text style={styles.label}>Identity</Text>
        <Text style={styles.meta}>
          This name and role guide how the employee introduces itself and approaches work.
        </Text>
        <Text style={styles.fieldLabel}>Employee name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Display name"
          placeholderTextColor={colors.silverMid}
          editable={!busy}
        />
        <Text style={styles.fieldLabel}>Role description</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={role}
          onChangeText={setRole}
          placeholder="Role description"
          placeholderTextColor={colors.silverMid}
          multiline
          textAlignVertical="top"
          editable={!busy}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          style={[styles.primaryBtn, busy && styles.disabled]}
          onPress={() => void save()}
          disabled={busy}
        >
          {busy
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.primaryBtnText}>Save changes</Text>}
        </Pressable>
      </View>

      <View style={[styles.card, styles.dangerCard]}>
        <Text style={styles.dangerTitle}>Dismiss employee</Text>
        <Text style={styles.meta}>
          Remove this employee and stop its connected work.
        </Text>
        <Pressable
          style={styles.dangerBtn}
          onPress={confirmDismiss}
          disabled={busy}
        >
          <Text style={styles.dangerBtnText}>Dismiss {worker.name}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function EmployeeSettingsScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const workerId = typeof params.id === 'string' ? params.id : '';
  return (
    <ScreenShell title="Employee settings" subtitle="Identity and access" showBack scroll>
      <CloudFeatureGate feature="aiva">
        {workerId
          ? <EmployeeSettings workerId={workerId} />
          : <ErrorRetryCard message="Missing employee id." onRetry={() => router.back()} />}
      </CloudFeatureGate>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.md },
  card: {
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.inkMid,
  },
  label: {
    color: colors.amber,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  meta: { color: colors.silver, fontSize: 13, lineHeight: 18 },
  fieldLabel: { color: colors.white, fontSize: 13, fontWeight: '600', marginTop: spacing.xs },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.white,
    backgroundColor: colors.ink,
    fontSize: 15,
  },
  textarea: { minHeight: 130 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  primaryBtn: {
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.6 },
  dangerCard: { borderColor: colors.danger },
  dangerTitle: { color: colors.danger, fontSize: 16, fontWeight: '700' },
  dangerBtn: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  dangerBtnText: { color: colors.danger, fontSize: 14, fontWeight: '700' },
});

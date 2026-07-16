import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  AivaApiError,
  fetchAivaSubscriptionStatus,
  getAivaWorker,
  pauseAivaWorker,
  resumeAivaWorker,
  type AivaSubscriptionStatus,
  type AivaWorkerDetail,
} from '@/api/aiva-client';
import { AivaEmployeeSectionNav } from '@/components/AivaEmployeeSectionNav';
import { CloudFeatureGate } from '@/components/CloudFeatureGate';
import { ErrorRetryCard } from '@/components/ErrorRetryCard';
import { LoadingPanel } from '@/components/LoadingPanel';
import { ScreenShell } from '@/components/ScreenShell';
import {
  applyWorkerStatus,
  buildAivaUsageGlance,
  mapAivaWorkerDetailOverview,
  resolvePauseResumeStatus,
} from '@/lib/aiva-employee-detail';
import { isApiAuthError } from '@/lib/cloud-features';
import { useAuth } from '@/store/auth-store';
import { colors, radii, spacing } from '@/theme/tokens';

const SECTION_CARDS = [
  { id: 'chat', title: 'Chat', detail: 'Message this employee directly.' },
  { id: 'tasks', title: 'Tasks', detail: 'Assign work and review progress.' },
  { id: 'channels', title: 'Channels', detail: 'Connect WhatsApp, email, and more.' },
  { id: 'training', title: 'Training', detail: 'Manage knowledge and FAQs.' },
  { id: 'automations', title: 'Automations', detail: 'Schedule recurring work.' },
  { id: 'settings', title: 'Settings', detail: 'Edit identity or dismiss employee.' },
] as const;

function EmployeeOverview({ workerId }: { workerId: string }) {
  const { instance, gatewayAuth } = useAuth();
  const [worker, setWorker] = useState<AivaWorkerDetail | null>(null);
  const [subscription, setSubscription] = useState<AivaSubscriptionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!instance?.baseUrl || !gatewayAuth?.apiKey) {
      setError('Sign in to Carina Cloud to view this employee.');
      setSessionExpired(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [detail, status] = await Promise.all([
        getAivaWorker(instance.baseUrl, workerId, gatewayAuth),
        fetchAivaSubscriptionStatus(instance.baseUrl, gatewayAuth).catch(() => null),
      ]);
      setWorker(detail);
      setSubscription(status);
      setSessionExpired(false);
      setNotFound(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = err instanceof AivaApiError ? err.status : 0;
      setError(message);
      setSessionExpired(isApiAuthError(message) || status === 401);
      setNotFound(status === 404);
    } finally {
      setLoading(false);
    }
  }, [gatewayAuth, instance?.baseUrl, workerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const togglePause = useCallback(async () => {
    if (!worker || !instance?.baseUrl || !gatewayAuth?.apiKey || busy) return;
    const action = worker.status === 'paused' ? 'resume' : 'pause';
    if (action === 'pause') {
      const confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert('Pause employee?', 'Message processing will stop until you resume.', [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Pause', style: 'destructive', onPress: () => resolve(true) },
        ]);
      });
      if (!confirmed) return;
    }

    const previous = worker.status;
    setWorker(applyWorkerStatus(
      worker,
      resolvePauseResumeStatus({ previous, action, outcome: 'success' }),
    ));
    setBusy(true);
    setError(null);
    try {
      const updated = action === 'pause'
        ? await pauseAivaWorker(instance.baseUrl, worker.id, gatewayAuth)
        : await resumeAivaWorker(instance.baseUrl, worker.id, gatewayAuth);
      setWorker(updated);
    } catch (err) {
      setWorker(applyWorkerStatus(
        worker,
        resolvePauseResumeStatus({ previous, action, outcome: 'failure' }),
      ));
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [busy, gatewayAuth, instance?.baseUrl, worker]);

  if (loading) return <LoadingPanel label="Loading employee" />;
  if (error || !worker) {
    return (
      <ErrorRetryCard
        message={
          sessionExpired
            ? 'Your Carina Cloud session expired. Sign in again to continue.'
            : notFound
              ? 'Employee not found. It may have been dismissed.'
              : error ?? 'Could not load employee.'
        }
        onRetry={() => {
          if (sessionExpired) {
            router.replace({ pathname: '/(auth)/login', params: { expired: '1' } });
          } else if (notFound) {
            router.replace('/(tabs)/employees' as Href);
          } else {
            void load();
          }
        }}
        retryLabel={sessionExpired ? 'Sign in again' : notFound ? 'Back to employees' : 'Retry'}
      />
    );
  }

  const overview = mapAivaWorkerDetailOverview(worker);
  const usage = buildAivaUsageGlance(worker, subscription);

  return (
    <View style={styles.block}>
      <AivaEmployeeSectionNav workerId={worker.id} active="overview" />

      <View style={styles.headerCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{overview.initials}</Text>
        </View>
        <View style={styles.headerBody}>
          <Text style={styles.name} numberOfLines={2}>{overview.name}</Text>
          <View style={[styles.chip, { borderColor: overview.chip.color }]}>
            <View style={[styles.chipDot, { backgroundColor: overview.chip.color }]} />
            <Text style={[styles.chipText, { color: overview.chip.color }]}>
              {overview.chip.label}
            </Text>
          </View>
          <Text style={styles.role} numberOfLines={4}>{overview.roleDescription}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Usage</Text>
        <Text style={styles.metric}>
          {usage.messagesToday} message{usage.messagesToday === 1 ? '' : 's'} today
        </Text>
        <Text style={styles.meta}>{usage.totalMessages} total</Text>
        {usage.creditLine ? <Text style={styles.credit}>{usage.creditLine}</Text> : null}
      </View>

      <Pressable
        style={[styles.primaryBtn, busy && styles.disabled]}
        onPress={() => void togglePause()}
        disabled={busy || (!overview.canPause && !overview.canResume)}
      >
        {busy
          ? <ActivityIndicator color={colors.white} />
          : <Text style={styles.primaryBtnText}>{overview.canResume ? 'Resume' : 'Pause'}</Text>}
      </Pressable>

      <View style={styles.sectionGrid}>
        {SECTION_CARDS.map((section) => (
          <Pressable
            key={section.id}
            style={styles.sectionCard}
            onPress={() => router.push(`/employee/${worker.id}/${section.id}` as Href)}
          >
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.meta}>{section.detail}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function EmployeeDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const workerId = typeof params.id === 'string' ? params.id : '';
  return (
    <ScreenShell title="Employee" subtitle="Overview" showBack scroll>
      <CloudFeatureGate feature="aiva">
        {workerId
          ? <EmployeeOverview workerId={workerId} />
          : <ErrorRetryCard message="Missing employee id." onRetry={() => router.back()} />}
      </CloudFeatureGate>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.md },
  headerCard: {
    flexDirection: 'row',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.lg,
    padding: spacing.md,
    backgroundColor: colors.inkMid,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.inkLift,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.tealLight, fontSize: 20, fontWeight: '700' },
  headerBody: { flex: 1, gap: spacing.xs, minWidth: 0 },
  name: { color: colors.white, fontSize: 22, fontWeight: '700' },
  role: { color: colors.silver, fontSize: 13, lineHeight: 18 },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 12, fontWeight: '700' },
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
  metric: { color: colors.white, fontSize: 17, fontWeight: '600' },
  meta: { color: colors.silver, fontSize: 13, lineHeight: 18 },
  credit: { color: colors.amber, fontSize: 13, marginTop: spacing.xs },
  primaryBtn: {
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.6 },
  sectionGrid: { gap: spacing.sm },
  sectionCard: {
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.lg,
    padding: spacing.md,
    backgroundColor: colors.inkMid,
  },
  sectionTitle: {
    color: colors.tealLight,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
});

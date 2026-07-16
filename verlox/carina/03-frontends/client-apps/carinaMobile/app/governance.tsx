import * as WebBrowser from 'expo-web-browser';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  fetchAivaGovernanceStatus,
  governanceStatusLabel,
  type AivaGovernanceStatus,
} from '@/api/aiva-governance';
import { AivaApiError } from '@/api/aiva-client';
import { CloudFeatureGate } from '@/components/CloudFeatureGate';
import { ErrorRetryCard } from '@/components/ErrorRetryCard';
import { LoadingPanel } from '@/components/LoadingPanel';
import { ScreenShell } from '@/components/ScreenShell';
import { isApiAuthError } from '@/lib/cloud-features';
import { useAuth } from '@/store/auth-store';
import { colors, radii, spacing } from '@/theme/tokens';

function formatWhen(iso: string | null): string {
  if (!iso) return 'No heartbeat yet';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function GovernanceBody() {
  const { instance, gatewayAuth } = useAuth();
  const [status, setStatus] = useState<AivaGovernanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(
    async (mode: 'full' | 'soft' = 'full') => {
      if (!instance?.baseUrl || !gatewayAuth?.apiKey) {
        setError('Sign in to Carina Cloud to open governance.');
        setSessionExpired(true);
        setLoading(false);
        return;
      }
      if (mode === 'full') setLoading(true);
      else setRefreshing(true);
      setError(null);
      setSessionExpired(false);
      try {
        const next = await fetchAivaGovernanceStatus(instance.baseUrl, gatewayAuth);
        setStatus(next);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const code = err instanceof AivaApiError ? err.status : 0;
        setError(message);
        setSessionExpired(isApiAuthError(message) || code === 401);
        if (mode === 'full') setStatus(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [gatewayAuth, instance?.baseUrl],
  );

  useFocusEffect(
    useCallback(() => {
      void refresh('full');
    }, [refresh]),
  );

  const openDashboard = useCallback(async () => {
    if (!status?.scoutDashboardUrl || busy) return;
    setBusy(true);
    try {
      await WebBrowser.openBrowserAsync(status.scoutDashboardUrl);
    } finally {
      setBusy(false);
    }
  }, [busy, status?.scoutDashboardUrl]);

  if (loading && !status) return <LoadingPanel label="Loading governance..." />;

  if (error && !status) {
    return (
      <ErrorRetryCard
        message={
          sessionExpired
            ? 'Your Carina Cloud session expired. Sign in again to continue.'
            : error
        }
        onRetry={() => {
          if (sessionExpired) {
            router.replace({ pathname: '/(auth)/login', params: { expired: '1' } });
            return;
          }
          void refresh('full');
        }}
        retryLabel={sessionExpired ? 'Sign in again' : 'Retry'}
      />
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void refresh('soft')}
          tintColor={colors.tealLight}
        />
      }
    >
      <View style={styles.card}>
        <Text style={styles.label}>Scout status</Text>
        <Text style={styles.value}>
          {status ? governanceStatusLabel(status.scoutStatus) : 'Unknown'}
        </Text>
        <Text style={styles.meta}>
          Last heartbeat: {formatWhen(status?.scoutLastHeartbeatAt ?? null)}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Employees monitored</Text>
        <Text style={styles.metric}>{status?.employeesMonitored ?? 0}</Text>
        <Text style={styles.meta}>
          Active {status?.employeesActive ?? 0} · Suspended by Scout{' '}
          {status?.employeesSuspendedByScout ?? 0}
        </Text>
        <Text style={styles.meta}>Events last 24h: {status?.eventsLast24h ?? 0}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Kill switch</Text>
        <Text style={styles.value}>
          {status?.killSwitchActive ? 'Active (employees suspended)' : 'Not active'}
        </Text>
        <Text style={styles.meta}>
          Trigger or review the kill switch on the Trust tab. This screen stays read-only for
          Aiva governance glance.
        </Text>
      </View>

      {status?.scoutDashboardUrl ? (
        <Pressable
          style={[styles.primaryBtn, busy && styles.btnDisabled]}
          onPress={() => void openDashboard()}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryBtnText}>Open Scout dashboard</Text>
          )}
        </Pressable>
      ) : null}

      <Pressable
        style={styles.secondaryBtn}
        onPress={() => router.push('/(tabs)/trust' as Href)}
        accessibilityRole="button"
        accessibilityLabel="Open Trust tab"
      >
        <Text style={styles.secondaryBtnText}>Open Trust (kill switch)</Text>
      </Pressable>
    </ScrollView>
  );
}

export default function GovernanceScreen() {
  return (
    <ScreenShell
      title="Governance"
      subtitle="Scout monitoring for your Aiva employees."
      showBack
      scroll={false}
    >
      <CloudFeatureGate feature="aiva">
        <GovernanceBody />
      </CloudFeatureGate>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: spacing.sm, paddingBottom: spacing.xl },
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
  value: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  metric: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '700',
  },
  meta: {
    color: colors.silver,
    fontSize: 13,
    lineHeight: 18,
  },
  primaryBtn: {
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryBtn: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: colors.tealLight,
    fontWeight: '700',
    fontSize: 15,
  },
  btnDisabled: { opacity: 0.7 },
});

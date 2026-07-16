import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CloudFeatureGate } from '@/components/CloudFeatureGate';
import { ErrorRetryCard } from '@/components/ErrorRetryCard';
import { LoadingPanel } from '@/components/LoadingPanel';
import { ScreenShell } from '@/components/ScreenShell';
import { useAivaSmoke } from '@/hooks/useAivaSmoke';
import { useAuth } from '@/store/auth-store';
import { colors, radii, spacing } from '@/theme/tokens';

function EmployeesSmokeBody() {
  const { instance, gatewayAuth } = useAuth();
  const { phase, workers, subscription, error, sessionExpired, planGate, refresh } = useAivaSmoke(
    instance?.baseUrl ?? null,
    gatewayAuth,
  );

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  if (phase === 'loading' || phase === 'idle') {
    return <LoadingPanel label="Loading employees" />;
  }

  if (phase === 'error') {
    return (
      <View style={styles.block}>
        <ErrorRetryCard
          message={
            sessionExpired
              ? 'Your Carina Cloud session expired. Sign in again to continue.'
              : planGate
                ? error ?? 'This plan cannot access Aiva employees right now.'
                : error ?? 'Could not load Aiva employees.'
          }
          onRetry={() => {
            if (sessionExpired) {
              router.replace({ pathname: '/(auth)/login', params: { expired: '1' } });
              return;
            }
            void refresh();
          }}
          retryLabel={sessionExpired ? 'Sign in again' : 'Retry'}
        />
      </View>
    );
  }

  return (
    <View style={styles.block}>
      <View style={styles.card}>
        <Text style={styles.label}>Workspace</Text>
        <Text style={styles.value}>
          {workers.length === 0
            ? 'No AI employees yet'
            : `${workers.length} AI employee${workers.length === 1 ? '' : 's'}`}
        </Text>
        {subscription ? (
          <Text style={styles.meta}>
            Plan {subscription.planTier} · {subscription.status}
            {typeof subscription.slotLimit === 'number'
              ? ` · ${subscription.aivasUsed}/${subscription.slotLimit} slots`
              : ''}
          </Text>
        ) : null}
      </View>

      {workers.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.label}>Employees</Text>
          {workers.slice(0, 8).map((worker) => (
            <View key={worker.id} style={styles.row}>
              <Text style={styles.rowTitle}>{worker.name}</Text>
              <Text style={styles.meta}>
                {worker.status}
                {worker.channels.length > 0 ? ` · ${worker.channels.length} channel(s)` : ''}
              </Text>
            </View>
          ))}
          {workers.length > 8 ? (
            <Text style={styles.meta}>Showing first 8. Full list arrives in the next update.</Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.meta}>
            Hire and manage AI employees from the web workspace for now. This tab confirms your
            cloud connection and will grow into the full Employees list next.
          </Text>
        </View>
      )}

      <Pressable
        style={styles.refreshBtn}
        onPress={() => void refresh()}
        accessibilityRole="button"
        accessibilityLabel="Refresh employees"
      >
        <Text style={styles.refreshText}>Refresh</Text>
      </Pressable>
    </View>
  );
}

export default function EmployeesScreen() {
  return (
    <ScreenShell
      title="Employees"
      subtitle="Aiva workspace connection check."
      scroll
    >
      <CloudFeatureGate feature="aiva">
        <EmployeesSmokeBody />
      </CloudFeatureGate>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing.md,
  },
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
    fontSize: 17,
    fontWeight: '600',
  },
  meta: {
    color: colors.silver,
    fontSize: 13,
    lineHeight: 18,
  },
  row: {
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderDim,
    gap: 2,
  },
  rowTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  refreshBtn: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  refreshText: {
    color: colors.tealLight,
    fontSize: 14,
    fontWeight: '600',
  },
});

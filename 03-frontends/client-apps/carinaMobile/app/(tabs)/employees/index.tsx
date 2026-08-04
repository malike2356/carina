import { router, type Href } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AivaWorkerRow } from '@/components/AivaWorkerRow';
import { CloudFeatureGate } from '@/components/CloudFeatureGate';
import { ErrorRetryCard } from '@/components/ErrorRetryCard';
import {
  DEFAULT_PAGE_SIZE,
  ListPager,
  slicePage,
  totalPagesFor,
} from '@/components/ListPager';
import { LoadingPanel } from '@/components/LoadingPanel';
import { ScreenShell } from '@/components/ScreenShell';
import { useAivaSmoke } from '@/hooks/useAivaSmoke';
import { mapAivaWorkersToListItems } from '@/lib/aiva-home';
import { useAuth } from '@/store/auth-store';
import { colors, radii, spacing } from '@/theme/tokens';

function WorkersBody() {
  const { instance, gatewayAuth } = useAuth();
  const { phase, workers, subscription, error, sessionExpired, planGate, refresh } = useAivaSmoke(
    instance?.baseUrl ?? null,
    gatewayAuth,
  );
  const [page, setPage] = useState(1);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      setPage(1);
    }, [refresh]),
  );

  const items = useMemo(() => mapAivaWorkersToListItems(workers), [workers]);
  const totalPages = totalPagesFor(items.length, DEFAULT_PAGE_SIZE);
  const pageItems = useMemo(
    () => slicePage(items, page, DEFAULT_PAGE_SIZE),
    [items, page],
  );

  if (phase === 'loading' || phase === 'idle') {
    return <LoadingPanel label="Loading workers" />;
  }

  if (phase === 'error') {
    return (
      <View style={styles.block}>
        <ErrorRetryCard
          message={
            sessionExpired
              ? 'Your session expired. Sign in again to continue.'
              : planGate
                ? error ?? 'This plan cannot access Aiva workers right now.'
                : error ?? 'Could not load workers.'
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

  if (items.length === 0) {
    return (
      <View style={styles.block}>
        <View style={styles.card}>
          <Text style={styles.emptyTitle}>No workers yet</Text>
          <Text style={styles.meta}>
            Hire one AI employee, then connect channels and chat with them.
          </Text>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => router.push('/(tabs)/hire' as Href)}
            accessibilityRole="button"
            accessibilityLabel="Hire a worker"
          >
            <Text style={styles.primaryBtnText}>Hire a worker</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.block}>
      {subscription ? (
        <Text style={styles.planMeta}>
          Plan {subscription.planTier} · {subscription.status}
          {typeof subscription.slotLimit === 'number'
            ? ` · ${subscription.aivasUsed}/${subscription.slotLimit} slots`
            : ''}
        </Text>
      ) : null}

      {pageItems.map((worker) => (
        <AivaWorkerRow
          key={worker.id}
          worker={worker}
          onPress={() => router.push(`/employee/${worker.id}` as Href)}
        />
      ))}

      <ListPager
        page={page}
        totalPages={totalPages}
        totalItems={items.length}
        onChangePage={setPage}
      />

      <Pressable
        style={styles.refreshBtn}
        onPress={() => {
          setPage(1);
          void refresh();
        }}
        accessibilityRole="button"
        accessibilityLabel="Refresh workers"
      >
        <Text style={styles.refreshText}>Refresh</Text>
      </Pressable>
    </View>
  );
}

export default function WorkersScreen() {
  return (
    <ScreenShell title="Workers" subtitle="Open one employee to chat or manage them." scroll>
      <CloudFeatureGate feature="aiva">
        <WorkersBody />
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
    gap: spacing.sm,
    backgroundColor: colors.inkMid,
  },
  emptyTitle: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '600',
  },
  meta: {
    color: colors.silver,
    fontSize: 13,
    lineHeight: 18,
  },
  planMeta: {
    color: colors.silverMid,
    fontSize: 12,
  },
  primaryBtn: {
    marginTop: spacing.sm,
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

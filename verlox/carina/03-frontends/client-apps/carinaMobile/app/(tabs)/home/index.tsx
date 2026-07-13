import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CloudFeatureGate } from '@/components/CloudFeatureGate';
import { ErrorRetryCard } from '@/components/ErrorRetryCard';
import { LoadingPanel } from '@/components/LoadingPanel';
import { ScreenShell } from '@/components/ScreenShell';
import { useAivaWorkspace } from '@/hooks/useAivaWorkspace';
import {
  buildAivaCreditHint,
  greetingNameFromEmail,
  resolveAivaNextAction,
} from '@/lib/aiva-home';
import { useAuth } from '@/store/auth-store';
import { colors, radii, spacing } from '@/theme/tokens';

function HomeBody() {
  const { instance, gatewayAuth, user } = useAuth();
  const { phase, workers, subscription, error, sessionExpired, planGate, refreshing, refresh } =
    useAivaWorkspace(instance?.baseUrl ?? null, gatewayAuth);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  if (phase === 'loading' || phase === 'idle') {
    return <LoadingPanel label="Loading workspace" />;
  }

  if (phase === 'error') {
    return (
      <ErrorRetryCard
        message={
          sessionExpired
            ? 'Your Carina Cloud session expired. Sign in again to continue.'
            : planGate
              ? error ?? 'This plan cannot access Aiva right now.'
              : error ?? 'Could not load your workspace.'
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
    );
  }

  const next = resolveAivaNextAction(workers);
  const creditHint = buildAivaCreditHint(subscription);
  const greeting = greetingNameFromEmail(user?.email);
  const directWorkerId = next.kind === 'open' ? next.workerId : workers[0]?.id;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void refresh()}
          tintColor={colors.tealLight}
        />
      }
    >
      <Text style={styles.hello}>Hello, {greeting}</Text>
      <Text style={styles.lead}>
        {subscription
          ? `Plan ${subscription.planTier} · ${subscription.status}`
          : 'Your Aiva workspace'}
        {subscription
          ? ` · ${subscription.aivasUsed}/${subscription.slotLimit} employee slots`
          : ''}
      </Text>

      {creditHint ? (
        <View style={styles.hintCard}>
          <Text style={styles.hintText}>{creditHint}</Text>
        </View>
      ) : null}

      <Pressable
        style={styles.primaryCta}
        onPress={() => {
          if (next.kind === 'hire') {
            router.push('/hire' as Href);
            return;
          }
          router.push(`/employee/${next.workerId}` as Href);
        }}
        accessibilityRole="button"
        accessibilityLabel={next.label}
      >
        <Text style={styles.primaryCtaText}>{next.label}</Text>
        <Text style={styles.primaryCtaSub}>{next.subtitle}</Text>
      </Pressable>

      {workers.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No employees yet</Text>
          <Text style={styles.emptyBody}>
            Hire an AI employee to handle conversations across your connected channels.
          </Text>
          <Pressable
            style={styles.secondaryCta}
            onPress={() => router.push('/hire' as Href)}
            accessibilityRole="button"
            accessibilityLabel="Hire an AI employee"
          >
            <Text style={styles.secondaryCtaText}>Hire employee</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.actionGrid}>
            <Pressable
              style={styles.actionCard}
              onPress={() => router.push('/(tabs)/employees' as Href)}
              accessibilityRole="button"
            >
              <Text style={styles.actionTitle}>Employees</Text>
              <Text style={styles.actionMeta}>
                {workers.filter((w) => w.status !== 'dismissed').length} active
              </Text>
            </Pressable>
            <Pressable
              style={styles.actionCard}
              onPress={() => {
                if (directWorkerId) router.push(`/employee/${directWorkerId}` as Href);
              }}
              accessibilityRole="button"
            >
              <Text style={styles.actionTitle}>Direct work</Text>
              <Text style={styles.actionMeta}>Chat and assign</Text>
            </Pressable>
            <Pressable
              style={styles.actionCard}
              onPress={() => router.push('/(tabs)/tasks' as Href)}
              accessibilityRole="button"
            >
              <Text style={styles.actionTitle}>Tasks</Text>
              <Text style={styles.actionMeta}>Open queue</Text>
            </Pressable>
            <Pressable
              style={styles.actionCard}
              onPress={() => router.push('/(tabs)/inbox' as Href)}
              accessibilityRole="button"
            >
              <Text style={styles.actionTitle}>Approvals</Text>
              <Text style={styles.actionMeta}>Review work</Text>
            </Pressable>
          </View>
        </>
      )}
    </ScrollView>
  );
}

export default function HomeScreen() {
  return (
    <ScreenShell title="Home" subtitle="What needs you next." scroll={false}>
      <CloudFeatureGate feature="aiva">
        <HomeBody />
      </CloudFeatureGate>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  hello: {
    color: colors.white,
    fontSize: 24,
    fontWeight: '700',
  },
  lead: {
    color: colors.silver,
    fontSize: 14,
    lineHeight: 20,
  },
  hintCard: {
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.lg,
    padding: spacing.md,
    backgroundColor: colors.inkMid,
  },
  hintText: {
    color: colors.amber,
    fontSize: 13,
    lineHeight: 18,
  },
  primaryCta: {
    backgroundColor: colors.teal,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
    minHeight: 72,
    justifyContent: 'center',
  },
  primaryCtaText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  primaryCtaSub: {
    color: colors.white,
    opacity: 0.85,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.inkMid,
  },
  emptyTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  emptyBody: {
    color: colors.silver,
    fontSize: 13,
    lineHeight: 18,
  },
  secondaryCta: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionCard: {
    width: '48%',
    minHeight: 82,
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.lg,
    padding: spacing.md,
    justifyContent: 'center',
    backgroundColor: colors.inkMid,
  },
  actionTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  actionMeta: {
    color: colors.silver,
    fontSize: 12,
    marginTop: 4,
  },
  secondaryCtaText: {
    color: colors.tealLight,
    fontWeight: '600',
    fontSize: 14,
  },
  linkRow: {
    paddingVertical: spacing.md,
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
});

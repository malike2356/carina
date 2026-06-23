import { useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScreenShell } from '@/components/ScreenShell';
import { useBilling } from '@/hooks/useBilling';
import { hapticLight } from '@/lib/haptics';
import { colors, radii, spacing } from '@/theme/tokens';

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
}

export default function UsageScreen() {
  const { data, loading, error, busy, refresh, openPortal, openCheckout } = useBilling();

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  async function handlePortal() {
    void hapticLight();
    const url = await openPortal();
    if (url) await WebBrowser.openBrowserAsync(url);
  }

  async function handleCheckout() {
    void hapticLight();
    const url = await openCheckout();
    if (url) await WebBrowser.openBrowserAsync(url);
  }

  const usagePercent =
    data?.usage.limit && data.usage.limit > 0
      ? Math.min(100, Math.round((data.usage.tokensUsed / data.usage.limit) * 100))
      : null;

  return (
    <ScreenShell
      title="Usage and billing"
      subtitle="Carina Cloud token usage, plan, and Stripe billing."
      showBack
      scroll={false}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void refresh()}
            tintColor={colors.tealLight}
          />
        }
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading && !data ? (
          <ActivityIndicator color={colors.tealLight} />
        ) : data ? (
          <>
            <View style={styles.card}>
              <Text style={styles.label}>Plan</Text>
              <Text style={styles.value}>{data.planName}</Text>
              <Text style={styles.meta}>
                {data.subscription.plan} · {data.subscription.status} · tier {data.tier}
              </Text>
              {data.monthlyPriceGbp !== null ? (
                <Text style={styles.meta}>£{data.monthlyPriceGbp}/month</Text>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Token usage (month)</Text>
              <Text style={styles.metric}>
                {formatTokens(data.usage.tokensUsed)}
                {data.usage.limit ? ` / ${formatTokens(data.usage.limit)}` : ''}
              </Text>
              {usagePercent !== null ? (
                <View style={styles.meterTrack}>
                  <View style={[styles.meterFill, { width: `${usagePercent}%` }]} />
                </View>
              ) : null}
              {data.usage.warning ? (
                <Text style={styles.warn}>{data.usage.warning}</Text>
              ) : null}
              {data.usage.blocked ? (
                <Text style={styles.error}>{data.usage.blocked}</Text>
              ) : null}
            </View>

            {data.freeDailyLimit !== null ? (
              <View style={styles.card}>
                <Text style={styles.label}>Messages today</Text>
                <Text style={styles.metric}>
                  {data.messagesToday} / {data.freeDailyLimit}
                </Text>
              </View>
            ) : null}

            <Pressable
              style={styles.primaryBtn}
              onPress={() => void handlePortal()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Open billing portal"
            >
              <Text style={styles.primaryBtnText}>Manage billing</Text>
            </Pressable>

            {data.tier !== 'pro' ? (
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => void handleCheckout()}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Upgrade to Pro"
              >
                <Text style={styles.secondaryBtnText}>Upgrade to Pro</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <Text style={styles.meta}>Sign in to Carina Cloud to view usage.</Text>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: spacing.md, paddingBottom: spacing.xl },
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
    fontWeight: '600',
  },
  metric: {
    color: colors.tealLight,
    fontSize: 24,
    fontWeight: '700',
  },
  meta: {
    color: colors.silver,
    fontSize: 13,
    lineHeight: 18,
  },
  meterTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.inkLift,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  meterFill: {
    height: '100%',
    backgroundColor: colors.teal,
  },
  warn: {
    color: colors.amber,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  primaryBtn: {
    backgroundColor: colors.teal,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 15,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: colors.tealLight,
    fontWeight: '600',
    fontSize: 15,
  },
});

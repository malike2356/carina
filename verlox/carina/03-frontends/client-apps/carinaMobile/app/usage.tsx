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
import { CloudFeatureGate } from '@/components/CloudFeatureGate';
import { ScreenShell } from '@/components/ScreenShell';
import { useBilling } from '@/hooks/useBilling';
import { hapticLight } from '@/lib/haptics';
import { useAuth } from '@/store/auth-store';
import { colors, radii, spacing } from '@/theme/tokens';

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
}

function UsageScreenBody() {
  const { instance } = useAuth();
  const {
    data,
    aiva,
    loading,
    error,
    busy,
    refresh,
    openPortal,
    openCheckout,
    openTopup,
    aivaAvailable,
  } = useBilling();

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

  async function handleTopup(packId: string) {
    void hapticLight();
    const url = await openTopup(packId);
    if (url) await WebBrowser.openBrowserAsync(url);
  }

  async function handleByok() {
    void hapticLight();
    const base = (instance?.baseUrl ?? '').replace(/\/+$/, '');
    if (!base) return;
    await WebBrowser.openBrowserAsync(`${base}/settings/keys`);
  }

  const usagePercent =
    data?.usage.limit && data.usage.limit > 0
      ? Math.min(100, Math.round((data.usage.tokensUsed / data.usage.limit) * 100))
      : null;

  return (
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
      {error ? (
        <View style={styles.errorBlock}>
          <Text style={styles.error}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => void refresh()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
      {loading && !data && !aiva ? (
        <ActivityIndicator color={colors.tealLight} />
      ) : (
        <>
          {aivaAvailable && aiva ? (
            <>
              <View style={styles.card}>
                <Text style={styles.label}>Aiva plan</Text>
                <Text style={styles.value}>{aiva.planTier}</Text>
                <Text style={styles.meta}>
                  Status {aiva.status}
                  {aiva.trialDaysRemaining != null
                    ? ` · trial ${aiva.trialDaysRemaining} day(s) left`
                    : ''}
                </Text>
                {aiva.trialEndsAt ? (
                  <Text style={styles.meta}>
                    Trial ends {new Date(aiva.trialEndsAt).toLocaleDateString()}
                  </Text>
                ) : null}
              </View>

              {aiva.wallet ? (
                <View style={styles.card}>
                  <Text style={styles.label}>Managed AI credit</Text>
                  <Text style={styles.metric}>£{aiva.wallet.remainingGbp.toFixed(2)}</Text>
                  <Text style={styles.meta}>
                    {aiva.wallet.exhausted
                      ? 'Credit exhausted'
                      : aiva.wallet.lowCredit
                        ? 'Low credit warning'
                        : 'Wallet balance'}
                    {aiva.wallet.byokActive ? ' · BYOK active' : ''}
                  </Text>
                </View>
              ) : null}

              {aiva.agentLimits ? (
                <View style={styles.card}>
                  <Text style={styles.label}>
                    Usage allowance ({aiva.agentLimits.period})
                  </Text>
                  <Text style={styles.meta}>
                    {aiva.agentLimits.remainingCalls != null
                      ? `${aiva.agentLimits.remainingCalls.toLocaleString()} calls remaining`
                      : `${aiva.agentLimits.usedCalls.toLocaleString()} calls used`}
                    {aiva.agentLimits.remainingTokens != null
                      ? ` · ${formatTokens(aiva.agentLimits.remainingTokens)} tokens remaining`
                      : ''}
                    {aiva.agentLimits.custom ? ' · custom policy' : ''}
                  </Text>
                  {aiva.agentLimits.maxCalls != null ? (
                    <Text style={styles.meta}>
                      {aiva.agentLimits.usedCalls.toLocaleString()} /{' '}
                      {aiva.agentLimits.maxCalls.toLocaleString()} calls
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {aiva.softWall ? (
                <View style={styles.softWall}>
                  <Text style={styles.softTitle}>
                    {aiva.wallet?.exhausted
                      ? 'Managed AI credit used up'
                      : 'Your trial has ended'}
                  </Text>
                  <Text style={styles.meta}>
                    Connect your own API key, top up managed credit, or upgrade so employees can
                    keep running.
                  </Text>
                  {aiva.softWallActions.includes('byok') ? (
                    <Pressable
                      style={styles.secondaryBtn}
                      onPress={() => void handleByok()}
                      disabled={busy}
                    >
                      <Text style={styles.secondaryBtnText}>Add BYOK key</Text>
                    </Pressable>
                  ) : null}
                  {aiva.softWallActions.includes('topup')
                    ? aiva.packs.map((pack) => (
                        <Pressable
                          key={pack.id}
                          style={styles.secondaryBtn}
                          onPress={() => void handleTopup(pack.id)}
                          disabled={busy}
                        >
                          <Text style={styles.secondaryBtnText}>
                            Top up {pack.label}
                          </Text>
                        </Pressable>
                      ))
                    : null}
                  {aiva.softWallActions.includes('upgrade') ? (
                    <Pressable
                      style={styles.primaryBtn}
                      onPress={() => void handleCheckout()}
                      disabled={busy}
                    >
                      <Text style={styles.primaryBtnText}>Upgrade plan</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {aiva.prepaidRemainingMessages > 0 ? (
                <Text style={styles.meta}>
                  Prepaid remaining: {aiva.prepaidRemainingMessages} messages (£
                  {aiva.prepaidRemainingGbp.toFixed(2)})
                </Text>
              ) : null}
            </>
          ) : null}

          {data ? (
            <>
              <View style={styles.card}>
                <Text style={styles.label}>Carina Cloud plan</Text>
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
            </>
          ) : null}

          {!data && !aiva && !loading ? (
            <Text style={styles.meta}>Usage data is not available yet. Pull to refresh.</Text>
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

          {!aiva?.softWall && (aivaAvailable || data?.tier !== 'pro') ? (
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => void handleCheckout()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Upgrade plan"
            >
              <Text style={styles.secondaryBtnText}>
                {aivaAvailable ? 'Upgrade Aiva plan' : 'Upgrade to Pro'}
              </Text>
            </Pressable>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

export default function UsageScreen() {
  return (
    <ScreenShell
      title="Usage and billing"
      subtitle="Plan, managed credit, limits, and Stripe billing."
      showBack
      scroll={false}
    >
      <CloudFeatureGate feature="billing">
        <UsageScreenBody />
      </CloudFeatureGate>
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
  softWall: {
    borderWidth: 1,
    borderColor: colors.amber,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.inkMid,
  },
  softTitle: {
    color: colors.amber,
    fontSize: 16,
    fontWeight: '700',
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
  errorBlock: {
    gap: spacing.sm,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: {
    color: colors.tealLight,
    fontSize: 13,
    fontWeight: '600',
  },
  primaryBtn: {
    backgroundColor: colors.teal,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
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
    minHeight: 48,
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: colors.tealLight,
    fontWeight: '600',
    fontSize: 15,
  },
});

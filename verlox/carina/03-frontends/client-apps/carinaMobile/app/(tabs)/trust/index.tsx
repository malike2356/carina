import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { KillSwitchPanel } from '@/components/KillSwitchPanel';
import { LoadingPanel } from '@/components/LoadingPanel';
import { ErrorRetryCard } from '@/components/ErrorRetryCard';
import { ScreenShell } from '@/components/ScreenShell';
import { SecurityEventCard } from '@/components/SecurityEventCard';
import { TrustMetricsGrid } from '@/components/TrustMetricsGrid';
import { TrustScoreCard } from '@/components/TrustScoreCard';
import { useTrustDashboard } from '@/hooks/useTrustDashboard';
import { colors, spacing } from '@/theme/tokens';

export default function TrustScreen() {
  const {
    loading,
    error,
    scoutError,
    trust,
    events,
    killSwitch,
    lastUpdated,
    canUseKillSwitch,
    triggering,
    refresh,
    triggerKillSwitch,
  } = useTrustDashboard();

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return (
    <ScreenShell
      title="Trust"
      subtitle="Public Scout trust score for the Carina platform. When you use Carina Cloud with Scout, your tenant events and kill switch appear here."
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
        {error ? (
          <ErrorRetryCard message={error} onRetry={() => void refresh()} />
        ) : null}
        {scoutError ? <Text style={styles.warn}>{scoutError}</Text> : null}

        {loading && !trust ? <LoadingPanel label="Loading trust data..." /> : null}

        <TrustScoreCard trust={trust} loading={loading} />
        <TrustMetricsGrid trust={trust} />

        {trust?.chain ? (
          <View style={styles.chainCard}>
            <Text style={styles.sectionTitle}>On-chain</Text>
            <Text style={styles.chainLine}>ERC-8004: {trust.chain.erc8004_label}</Text>
            <Text style={styles.chainLine}>ERC-8126: {trust.chain.erc8126_label}</Text>
          </View>
        ) : null}

        <KillSwitchPanel
          status={killSwitch}
          enabled={canUseKillSwitch}
          triggering={triggering}
          onTrigger={triggerKillSwitch}
        />

        <Text style={styles.sectionTitle}>
          Security events ({events.length})
        </Text>
        {loading && events.length === 0 ? (
          <ActivityIndicator color={colors.tealLight} />
        ) : events.length === 0 ? (
          <Text style={styles.empty}>
            No tenant events yet. Public platform metrics appear above. Scout subscribers see
            instance events here.
          </Text>
        ) : (
          <View style={styles.eventList}>
            {events.map((event) => (
              <SecurityEventCard key={event.id} event={event} />
            ))}
          </View>
        )}

        {lastUpdated ? (
          <Text style={styles.updated}>
            Updated {new Date(lastUpdated).toLocaleTimeString()} · polls every 60s
          </Text>
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  warn: {
    color: colors.amber,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    color: colors.amber,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  chainCard: {
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: 12,
    padding: spacing.md,
    backgroundColor: colors.inkMid,
    gap: spacing.xs,
  },
  chainLine: {
    color: colors.silver,
    fontSize: 13,
  },
  eventList: {
    gap: spacing.sm,
  },
  empty: {
    color: colors.silver,
    fontSize: 13,
    lineHeight: 18,
  },
  updated: {
    color: colors.silverMid,
    fontSize: 11,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});

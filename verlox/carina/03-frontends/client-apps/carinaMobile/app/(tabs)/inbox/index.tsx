import * as WebBrowser from 'expo-web-browser';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  listCombinedApprovals,
  mapApprovalToInboxRow,
  type AivaApprovalItem,
} from '@/api/aiva-approvals';
import { startAivaCheckout } from '@/api/aiva-billing';
import { listAivaWorkers, AivaApiError } from '@/api/aiva-client';
import {
  listConversations,
  type AivaConversationSummary,
} from '@/api/aiva-conversations';
import { listOpenEscalations, type AivaEscalation } from '@/api/aiva-escalations';
import type { PlanGateInfo } from '@/api/aiva-automations';
import { CloudFeatureGate } from '@/components/CloudFeatureGate';
import { ErrorRetryCard } from '@/components/ErrorRetryCard';
import { LoadingPanel } from '@/components/LoadingPanel';
import { ScreenShell } from '@/components/ScreenShell';
import { isApiAuthError } from '@/lib/cloud-features';
import {
  INBOX_SEGMENTS,
  inboxSegmentSubtitle,
  parseInboxSegment,
  type InboxSegment,
} from '@/lib/inbox-nav';
import { useAuth } from '@/store/auth-store';
import { colors, radii, spacing } from '@/theme/tokens';

function formatWhen(iso: string | null): string {
  if (!iso) return 'No activity';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function ageLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function SegmentBar({
  segment,
  onChange,
}: {
  segment: InboxSegment;
  onChange: (next: InboxSegment) => void;
}) {
  return (
    <View style={styles.segmentRow}>
      {INBOX_SEGMENTS.map((item) => {
        const active = item.id === segment;
        return (
          <Pressable
            key={item.id}
            style={[styles.segmentChip, active && styles.segmentChipActive]}
            onPress={() => onChange(item.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.label}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ApprovalsPane() {
  const { instance, gatewayAuth } = useAuth();
  const [items, setItems] = useState<AivaApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const refresh = useCallback(
    async (mode: 'full' | 'soft' = 'full') => {
      if (!instance?.baseUrl || !gatewayAuth?.apiKey) {
        setError('Sign in to Carina Cloud to open Inbox.');
        setSessionExpired(true);
        setLoading(false);
        return;
      }
      if (mode === 'full') setLoading(true);
      else setRefreshing(true);
      setError(null);
      setSessionExpired(false);
      try {
        const workers = await listAivaWorkers(instance.baseUrl, gatewayAuth).catch(() => []);
        const names = new Map(workers.map((w) => [w.id, w.name]));
        const next = await listCombinedApprovals(instance.baseUrl, gatewayAuth, names);
        setItems(next);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const status = err instanceof AivaApiError ? err.status : 0;
        setError(message);
        setSessionExpired(isApiAuthError(message) || status === 401);
        if (mode === 'full') setItems([]);
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

  if (loading && items.length === 0) return <LoadingPanel label="Loading approvals" />;

  if (error && items.length === 0) {
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

  const rows = items.map((item) => mapApprovalToInboxRow(item));

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
      {rows.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Nothing needs you</Text>
          <Text style={styles.meta}>
            When an AI employee drafts an email or social reply that needs approval, it will
            show up here.
          </Text>
        </View>
      ) : (
        rows.map((row) => (
          <Pressable
            key={`${row.kind}:${row.id}`}
            style={styles.card}
            onPress={() => router.push(`/approval/${row.kind}/${row.id}` as Href)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${row.typeLabel} approval`}
          >
            <View style={styles.cardTop}>
              <Text style={styles.type}>{row.typeLabel}</Text>
              <Text style={styles.age}>{row.ageLabel}</Text>
            </View>
            <Text style={styles.title} numberOfLines={2}>
              {row.title}
            </Text>
            <Text style={styles.meta} numberOfLines={2}>
              {row.preview}
            </Text>
            <Text style={styles.worker}>{row.workerName}</Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

function ConversationsPane() {
  const { instance, gatewayAuth } = useAuth();
  const [items, setItems] = useState<AivaConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const refresh = useCallback(
    async (mode: 'full' | 'soft' = 'full') => {
      if (!instance?.baseUrl || !gatewayAuth?.apiKey) {
        setError('Sign in to Carina Cloud to open conversations.');
        setSessionExpired(true);
        setLoading(false);
        return;
      }
      if (mode === 'full') setLoading(true);
      else setRefreshing(true);
      setError(null);
      setSessionExpired(false);
      try {
        const next = await listConversations(instance.baseUrl, gatewayAuth, { limit: 40 });
        setItems(next.conversations);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const status = err instanceof AivaApiError ? err.status : 0;
        setError(message);
        setSessionExpired(isApiAuthError(message) || status === 401);
        if (mode === 'full') setItems([]);
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

  if (loading && items.length === 0) return <LoadingPanel label="Loading conversations" />;

  if (error && items.length === 0) {
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
      <Text style={styles.hint}>Threads are read-only on mobile.</Text>
      {items.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.meta}>
            When employees talk with contacts on connected channels, recent threads appear here.
          </Text>
        </View>
      ) : (
        items.map((item) => (
          <Pressable
            key={item.id}
            style={styles.card}
            onPress={() => router.push(`/conversation/${item.id}` as Href)}
            accessibilityRole="button"
            accessibilityLabel={`Open conversation with ${item.workerName}`}
          >
            <View style={styles.cardTop}>
              <Text style={styles.type}>{item.channel}</Text>
              <Text style={styles.age}>{formatWhen(item.lastMessageAt)}</Text>
            </View>
            <Text style={styles.title} numberOfLines={2}>
              {item.lastMessagePreview || '(no preview)'}
            </Text>
            <Text style={styles.meta}>
              {item.workerName} · {item.status}
              {item.hasEscalation ? ' · escalated' : ''}
            </Text>
            <Text style={styles.worker}>
              {item.messageCount} message{item.messageCount === 1 ? '' : 's'}
            </Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

function EscalationsPane() {
  const { instance, gatewayAuth } = useAuth();
  const [items, setItems] = useState<AivaEscalation[]>([]);
  const [planGate, setPlanGate] = useState<PlanGateInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  const refresh = useCallback(
    async (mode: 'full' | 'soft' = 'full') => {
      if (!instance?.baseUrl || !gatewayAuth?.apiKey) {
        setError('Sign in to Carina Cloud to open escalations.');
        setSessionExpired(true);
        setLoading(false);
        return;
      }
      if (mode === 'full') setLoading(true);
      else setRefreshing(true);
      setError(null);
      setSessionExpired(false);
      setPlanGate(null);
      try {
        const next = await listOpenEscalations(instance.baseUrl, gatewayAuth);
        setItems(next.escalations);
        setPlanGate(next.planGate.required ? next.planGate : null);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const status = err instanceof AivaApiError ? err.status : 0;
        setError(message);
        setSessionExpired(isApiAuthError(message) || status === 401);
        if (mode === 'full') setItems([]);
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

  const openUpgrade = useCallback(async () => {
    if (!instance?.baseUrl || !gatewayAuth?.apiKey || checkoutBusy) return;
    setCheckoutBusy(true);
    setActionError(null);
    try {
      const url = await startAivaCheckout(instance.baseUrl, 'team', gatewayAuth);
      await WebBrowser.openBrowserAsync(url);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setCheckoutBusy(false);
    }
  }, [checkoutBusy, gatewayAuth, instance?.baseUrl]);

  if (loading && items.length === 0 && !planGate) {
    return <LoadingPanel label="Loading escalations" />;
  }

  if (error && items.length === 0 && !planGate) {
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

  if (planGate?.required) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Team plan required</Text>
          <Text style={styles.meta}>
            {planGate.message ??
              'Escalations need a Team plan or higher. Upgrade to see open handoffs.'}
          </Text>
          {planGate.planTier ? (
            <Text style={styles.meta}>Current plan: {planGate.planTier}</Text>
          ) : null}
          <Pressable
            style={[styles.primaryBtn, checkoutBusy && styles.btnDisabled]}
            onPress={() => void openUpgrade()}
            disabled={checkoutBusy}
          >
            {checkoutBusy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.primaryBtnText}>Upgrade to Team</Text>
            )}
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => router.push('/usage' as Href)}>
            <Text style={styles.secondaryBtnText}>Open Usage and billing</Text>
          </Pressable>
          {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
        </View>
      </ScrollView>
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
      <Text style={styles.hint}>
        Customer resolve and assignment is ops-only. Open the employee for context, or use the web
        handoff queue to reply.
      </Text>
      {items.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No open escalations</Text>
          <Text style={styles.meta}>
            When an employee flags work for human review, open items will list here.
          </Text>
        </View>
      ) : (
        items.map((item) => (
          <Pressable
            key={item.id}
            style={styles.card}
            onPress={() => {
              if (item.workerId) {
                router.push(`/employee/${item.workerId}` as Href);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={`Open employee for escalation ${item.workerName}`}
          >
            <View style={styles.cardTop}>
              <Text style={styles.type}>{item.channel}</Text>
              <Text style={styles.age}>{ageLabel(item.createdAt)}</Text>
            </View>
            <Text style={styles.title} numberOfLines={3}>
              {item.originalInput || item.holdingMessage || 'Escalation'}
            </Text>
            {item.holdingMessage ? (
              <Text style={styles.meta} numberOfLines={2}>
                Holding: {item.holdingMessage}
              </Text>
            ) : null}
            <Text style={styles.worker}>
              {item.workerName} · {item.status}
            </Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

function InboxBody({ segment, onSegmentChange }: {
  segment: InboxSegment;
  onSegmentChange: (next: InboxSegment) => void;
}) {
  return (
    <View style={styles.body}>
      <SegmentBar segment={segment} onChange={onSegmentChange} />
      {segment === 'approvals' ? <ApprovalsPane /> : null}
      {segment === 'conversations' ? <ConversationsPane /> : null}
      {segment === 'escalations' ? <EscalationsPane /> : null}
    </View>
  );
}

export default function InboxScreen() {
  const params = useLocalSearchParams<{ segment?: string }>();
  const initial = useMemo(() => parseInboxSegment(params.segment), [params.segment]);
  const [segment, setSegment] = useState<InboxSegment>(initial);

  useEffect(() => {
    setSegment(parseInboxSegment(params.segment));
  }, [params.segment]);

  return (
    <ScreenShell title="Inbox" subtitle={inboxSegmentSubtitle(segment)} scroll={false}>
      <CloudFeatureGate feature="aiva">
        <InboxBody
          segment={segment}
          onSegmentChange={(next) => {
            setSegment(next);
            router.setParams({ segment: next });
          }}
        />
      </CloudFeatureGate>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, gap: spacing.sm },
  scroll: { flex: 1 },
  content: { gap: spacing.sm, paddingBottom: spacing.xl },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  segmentChip: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  segmentChipActive: {
    borderColor: colors.teal,
    backgroundColor: colors.inkMid,
  },
  segmentText: {
    color: colors.silver,
    fontSize: 13,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: colors.tealLight,
  },
  hint: {
    color: colors.silverMid,
    fontSize: 12,
    lineHeight: 17,
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
  card: {
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.inkMid,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  type: {
    color: colors.amber,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  age: {
    color: colors.silverMid,
    fontSize: 12,
  },
  title: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  meta: {
    color: colors.silver,
    fontSize: 13,
    lineHeight: 18,
  },
  worker: {
    color: colors.tealLight,
    fontSize: 12,
    fontWeight: '600',
    marginTop: spacing.xs,
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
  error: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
});

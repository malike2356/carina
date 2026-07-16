import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  createApprovalSubmitGuard,
  decideApproval,
  listCombinedApprovals,
  type AivaApprovalItem,
} from '@/api/aiva-approvals';
import { AivaApiError, listAivaWorkers } from '@/api/aiva-client';
import { CloudFeatureGate } from '@/components/CloudFeatureGate';
import { ErrorRetryCard } from '@/components/ErrorRetryCard';
import { LoadingPanel } from '@/components/LoadingPanel';
import { ScreenShell } from '@/components/ScreenShell';
import { formatApprovalAge } from '@/api/aiva-approvals';
import { isApiAuthError } from '@/lib/cloud-features';
import { useAuth } from '@/store/auth-store';
import { colors, radii, spacing } from '@/theme/tokens';

function ApprovalDetailBody({
  kind,
  approvalId,
}: {
  kind: 'email' | 'social';
  approvalId: string;
}) {
  const { instance, gatewayAuth } = useAuth();
  const [item, setItem] = useState<AivaApprovalItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const guardRef = useRef(createApprovalSubmitGuard());

  const load = useCallback(async () => {
    if (!instance?.baseUrl || !gatewayAuth?.apiKey) {
      setError('Sign in to Carina Cloud to review this draft.');
      setSessionExpired(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setSessionExpired(false);
    try {
      const workers = await listAivaWorkers(instance.baseUrl, gatewayAuth).catch(() => []);
      const names = new Map(workers.map((w) => [w.id, w.name]));
      const list = await listCombinedApprovals(instance.baseUrl, gatewayAuth, names);
      const found = list.find((entry) => entry.id === approvalId && entry.kind === kind) ?? null;
      if (!found) {
        setItem(null);
        setError('Approval not found or already resolved.');
        return;
      }
      setItem(found);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = err instanceof AivaApiError ? err.status : 0;
      setItem(null);
      setError(message);
      setSessionExpired(isApiAuthError(message) || status === 401);
    } finally {
      setLoading(false);
    }
  }, [approvalId, gatewayAuth, instance?.baseUrl, kind]);

  useEffect(() => {
    void load();
  }, [load]);

  const runDecision = useCallback(
    async (decision: 'approve' | 'reject') => {
      if (!item || !instance?.baseUrl || !gatewayAuth?.apiKey) return;
      const key = `${item.kind}:${item.id}:${decision}`;
      if (!guardRef.current.tryBegin(key)) return;
      setBusy(true);
      setActionError(null);
      try {
        await decideApproval(instance.baseUrl, item, decision, gatewayAuth);
        router.replace('/(tabs)/inbox' as Href);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : String(err));
      } finally {
        guardRef.current.end(key);
        setBusy(false);
      }
    },
    [gatewayAuth, instance?.baseUrl, item],
  );

  const confirmReject = useCallback(() => {
    Alert.alert(
      'Reject draft?',
      'This draft will not be sent. The AI employee will not auto-approve it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: () => {
            void runDecision('reject');
          },
        },
      ],
    );
  }, [runDecision]);

  if (loading) {
    return <LoadingPanel label="Loading draft" />;
  }

  if (error || !item) {
    return (
      <ErrorRetryCard
        message={
          sessionExpired
            ? 'Your Carina Cloud session expired. Sign in again to continue.'
            : error ?? 'Approval not found.'
        }
        onRetry={() => {
          if (sessionExpired) {
            router.replace({ pathname: '/(auth)/login', params: { expired: '1' } });
            return;
          }
          if (!item) {
            router.replace('/(tabs)/inbox' as Href);
            return;
          }
          void load();
        }}
        retryLabel={sessionExpired ? 'Sign in again' : item ? 'Retry' : 'Back to inbox'}
      />
    );
  }

  const body = item.kind === 'email' ? item.draftBody : item.draftText;
  const metaBits =
    item.kind === 'email'
      ? [
          `To: ${item.recipient}`,
          item.category,
          item.originalFrom ? `From: ${item.originalFrom}` : null,
        ]
      : [
          `Channel: ${item.channel}`,
          item.contactId ? `Contact: ${item.contactId}` : null,
          item.messageType ? `Type: ${item.messageType}` : null,
        ];

  return (
    <View style={styles.block}>
      <View style={styles.card}>
        <Text style={styles.kind}>{item.kind === 'email' ? 'Email' : item.channel}</Text>
        <Text style={styles.title}>
          {item.kind === 'email' ? item.subject : 'Social draft'}
        </Text>
        <Text style={styles.meta}>
          {(item.workerName ?? 'AI employee') + ' · ' + formatApprovalAge(item.requestedAt)}
        </Text>
        {metaBits.filter(Boolean).map((line) => (
          <Text key={String(line)} style={styles.meta}>
            {line}
          </Text>
        ))}
      </View>

      {item.kind === 'social' && item.inboundText ? (
        <View style={styles.card}>
          <Text style={styles.label}>Inbound</Text>
          <Text style={styles.body}>{item.inboundText}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.label}>Draft</Text>
        <Text style={styles.body}>{body || '(empty draft)'}</Text>
      </View>

      {actionError ? <Text style={styles.error}>{actionError}</Text> : null}

      <Pressable
        style={[styles.approveBtn, busy && styles.btnDisabled]}
        onPress={() => void runDecision('approve')}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Approve draft"
      >
        {busy ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.approveText}>Approve and send</Text>
        )}
      </Pressable>
      <Pressable
        style={[styles.rejectBtn, busy && styles.btnDisabled]}
        onPress={confirmReject}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Reject draft"
      >
        <Text style={styles.rejectText}>Reject</Text>
      </Pressable>
    </View>
  );
}

export default function ApprovalDetailScreen() {
  const params = useLocalSearchParams<{ kind?: string; id?: string }>();
  const kind = params.kind === 'social' ? 'social' : params.kind === 'email' ? 'email' : null;
  const approvalId = typeof params.id === 'string' ? params.id : '';

  return (
    <ScreenShell title="Review" subtitle="Approve or reject this draft." showBack scroll>
      <CloudFeatureGate feature="aiva">
        {kind && approvalId ? (
          <ApprovalDetailBody kind={kind} approvalId={approvalId} />
        ) : (
          <ErrorRetryCard
            message="Missing approval id."
            onRetry={() => router.replace('/(tabs)/inbox' as Href)}
            retryLabel="Back to inbox"
          />
        )}
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
    gap: spacing.xs,
    backgroundColor: colors.inkMid,
  },
  kind: {
    color: colors.amber,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  title: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '700',
  },
  label: {
    color: colors.amber,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  meta: {
    color: colors.silver,
    fontSize: 13,
    lineHeight: 18,
  },
  body: {
    color: colors.white,
    fontSize: 15,
    lineHeight: 22,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  approveBtn: {
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  rejectBtn: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectText: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 15,
  },
  btnDisabled: { opacity: 0.7 },
});

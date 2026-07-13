import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  fetchConversationThread,
  type AivaConversationThread,
} from '@/api/aiva-conversations';
import { AivaApiError } from '@/api/aiva-client';
import { CloudFeatureGate } from '@/components/CloudFeatureGate';
import { ErrorRetryCard } from '@/components/ErrorRetryCard';
import { LoadingPanel } from '@/components/LoadingPanel';
import { ScreenShell } from '@/components/ScreenShell';
import { isApiAuthError } from '@/lib/cloud-features';
import { useAuth } from '@/store/auth-store';
import { colors, radii, spacing } from '@/theme/tokens';

function formatWhen(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function roleLabel(role: string): string {
  if (role === 'user') return 'Contact';
  if (role === 'aiva') return 'Aiva';
  if (role === 'va') return 'Human reviewer';
  return 'System';
}

function ThreadBody({ conversationId }: { conversationId: string }) {
  const { instance, gatewayAuth } = useAuth();
  const [thread, setThread] = useState<AivaConversationThread | null>(null);
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
        const next = await fetchConversationThread(
          instance.baseUrl,
          conversationId,
          gatewayAuth,
        );
        setThread(next);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const status = err instanceof AivaApiError ? err.status : 0;
        setError(message);
        setSessionExpired(isApiAuthError(message) || status === 401);
        if (mode === 'full') setThread(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [conversationId, gatewayAuth, instance?.baseUrl],
  );

  useFocusEffect(
    useCallback(() => {
      void refresh('full');
    }, [refresh]),
  );

  if (loading && !thread) return <LoadingPanel label="Loading thread..." />;

  if (error && !thread) {
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

  if (!thread) {
    return <ErrorRetryCard message="Conversation not found." onRetry={() => void refresh('full')} />;
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
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Read-only</Text>
        <Text style={styles.meta}>
          Customer replies are not available in the app. Use the web ops VA queue for human
          replies.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>{thread.workerName}</Text>
        <Text style={styles.meta}>
          {thread.channel} · {thread.messageCount} message
          {thread.messageCount === 1 ? '' : 's'}
        </Text>
        {thread.contactId ? <Text style={styles.meta}>Contact {thread.contactId}</Text> : null}
      </View>

      {thread.messages.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No messages</Text>
          <Text style={styles.meta}>This thread has no messages yet.</Text>
        </View>
      ) : (
        thread.messages.map((message) => (
          <View key={message.id} style={styles.messageCard}>
            <View style={styles.cardTop}>
              <Text style={styles.role}>{roleLabel(message.role)}</Text>
              <Text style={styles.age}>{formatWhen(message.timestamp)}</Text>
            </View>
            {message.actionType ? (
              <Text style={styles.action}>{message.actionType}</Text>
            ) : null}
            <Text style={styles.body}>{message.content || message.summary || '(empty)'}</Text>
          </View>
        ))
      )}

      {thread.workerId ? (
        <Pressable
          style={styles.secondaryBtn}
          onPress={() => router.push(`/employee/${thread.workerId}` as Href)}
        >
          <Text style={styles.secondaryBtnText}>Open employee</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

export default function ConversationThreadScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const conversationId = typeof params.id === 'string' ? params.id : '';

  return (
    <ScreenShell title="Conversation" subtitle="Thread view." showBack scroll={false}>
      <CloudFeatureGate feature="aiva">
        {conversationId ? (
          <ThreadBody conversationId={conversationId} />
        ) : (
          <ErrorRetryCard message="Missing conversation id." onRetry={() => undefined} />
        )}
      </CloudFeatureGate>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: spacing.sm, paddingBottom: spacing.xl },
  banner: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.ink,
  },
  bannerTitle: {
    color: colors.amber,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  card: {
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.inkMid,
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
  messageCard: {
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
  title: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  role: {
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
  action: {
    color: colors.tealLight,
    fontSize: 12,
    fontWeight: '600',
  },
  body: {
    color: colors.white,
    fontSize: 14,
    lineHeight: 20,
  },
  meta: {
    color: colors.silver,
    fontSize: 13,
    lineHeight: 18,
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
});

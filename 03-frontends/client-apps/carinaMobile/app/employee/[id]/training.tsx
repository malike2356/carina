import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { startAivaCheckout } from '@/api/aiva-billing';
import { AivaApiError } from '@/api/aiva-client';
import {
  createWorkerFaq,
  deleteWorkerKnowledge,
  listWorkerKnowledge,
  validateFaqInput,
  type AivaKnowledgeList,
} from '@/api/aiva-training';
import { isPlanUpgradeError, planGateFromError } from '@/api/aiva-automations';
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
import { isApiAuthError } from '@/lib/cloud-features';
import { useAuth } from '@/store/auth-store';
import { colors, radii, spacing } from '@/theme/tokens';

function TrainingBody({ workerId }: { workerId: string }) {
  const { instance, gatewayAuth } = useAuth();
  const [data, setData] = useState<AivaKnowledgeList | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  const refresh = useCallback(
    async (mode: 'full' | 'soft' = 'full') => {
      if (!instance?.baseUrl || !gatewayAuth?.apiKey) {
        setError('Sign in to Carina Cloud to manage training.');
        setSessionExpired(true);
        setLoading(false);
        return;
      }
      if (mode === 'full') setLoading(true);
      else setRefreshing(true);
      setError(null);
      setSessionExpired(false);
      try {
        const next = await listWorkerKnowledge(instance.baseUrl, workerId, gatewayAuth);
        setData(next);
        setPage(1);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const status = err instanceof AivaApiError ? err.status : 0;
        setError(message);
        setSessionExpired(isApiAuthError(message) || status === 401);
        if (mode === 'full') setData(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [gatewayAuth, instance?.baseUrl, workerId],
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
      const url = await startAivaCheckout(instance.baseUrl, 'business', gatewayAuth);
      await WebBrowser.openBrowserAsync(url);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setCheckoutBusy(false);
    }
  }, [checkoutBusy, gatewayAuth, instance?.baseUrl]);

  const onCreate = useCallback(async () => {
    if (!instance?.baseUrl || !gatewayAuth?.apiKey || busy) return;
    const validation = validateFaqInput(question, answer);
    if (validation) {
      setActionError(validation);
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await createWorkerFaq(instance.baseUrl, workerId, question, answer, gatewayAuth);
      setQuestion('');
      setAnswer('');
      setShowForm(false);
      await refresh('soft');
    } catch (err) {
      if (isPlanUpgradeError(err)) {
        const gate = planGateFromError(err);
        setData((prev) =>
          prev
            ? { ...prev, planGate: gate }
            : {
                entries: [],
                usedChars: 0,
                maxChars: 50_000,
                planTier: gate.planTier,
                planGate: gate,
              },
        );
      } else {
        setActionError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setBusy(false);
    }
  }, [answer, busy, gatewayAuth, instance?.baseUrl, question, refresh, workerId]);

  const confirmDelete = useCallback(
    (entryId: string, title: string) => {
      if (!instance?.baseUrl || !gatewayAuth?.apiKey || busy) return;
      Alert.alert('Delete training item?', `Removes "${title}" from this employee.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true);
              setActionError(null);
              try {
                await deleteWorkerKnowledge(
                  instance.baseUrl,
                  workerId,
                  entryId,
                  gatewayAuth,
                );
                await refresh('soft');
              } catch (err) {
                setActionError(err instanceof Error ? err.message : String(err));
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ]);
    },
    [busy, gatewayAuth, instance?.baseUrl, refresh, workerId],
  );

  if (loading) return <LoadingPanel label="Loading training..." />;

  if (sessionExpired || (error && !data)) {
    return (
      <ErrorRetryCard
        message={error ?? 'Could not load training.'}
        onRetry={() => void refresh('full')}
        retryLabel={sessionExpired ? 'Sign in again' : 'Retry'}
      />
    );
  }

  if (data?.planGate.required) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Business plan required</Text>
          <Text style={styles.meta}>
            {data.planGate.message ??
              'Training knowledge needs a Business plan. Upgrade to add FAQs and docs for this employee.'}
          </Text>
          {data.planGate.planTier || data.planTier ? (
            <Text style={styles.meta}>
              Current plan: {data.planGate.planTier ?? data.planTier}
            </Text>
          ) : null}
          <Pressable
            style={[styles.primaryBtn, checkoutBusy && styles.btnDisabled]}
            onPress={() => void openUpgrade()}
            disabled={checkoutBusy}
          >
            {checkoutBusy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.primaryBtnText}>Upgrade to Business</Text>
            )}
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => router.push('/usage' as Href)}>
            <Text style={styles.secondaryBtnText}>Open Usage and billing</Text>
          </Pressable>
        </View>
        {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
      </ScrollView>
    );
  }

  const entries = data?.entries ?? [];
  const used = data?.usedChars ?? 0;
  const max = data?.maxChars ?? 50_000;
  const totalPages = totalPagesFor(entries.length, DEFAULT_PAGE_SIZE);
  const pageEntries = useMemo(
    () => slicePage(entries, page, DEFAULT_PAGE_SIZE),
    [entries, page],
  );

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void refresh('soft')}
          tintColor={colors.teal}
        />
      }
    >
      <View style={styles.card}>
        <Text style={styles.label}>Knowledge budget</Text>
        <Text style={styles.metric}>
          {used.toLocaleString()} / {max.toLocaleString()} characters
        </Text>
        {data?.planTier ? <Text style={styles.meta}>Plan: {data.planTier}</Text> : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {actionError ? <Text style={styles.error}>{actionError}</Text> : null}

      {!showForm ? (
        <Pressable
          style={styles.primaryBtn}
          onPress={() => {
            setActionError(null);
            setShowForm(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Add FAQ"
        >
          <Text style={styles.primaryBtnText}>Add FAQ</Text>
        </Pressable>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>New FAQ</Text>
          <Text style={styles.label}>Question</Text>
          <TextInput
            style={styles.input}
            value={question}
            onChangeText={setQuestion}
            placeholder="What are your hours?"
            placeholderTextColor={colors.silverMid}
            editable={!busy}
          />
          <Text style={styles.label}>Answer</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={answer}
            onChangeText={setAnswer}
            placeholder="We are open 9-5 Monday to Friday."
            placeholderTextColor={colors.silverMid}
            multiline
            textAlignVertical="top"
            editable={!busy}
          />
          <View style={styles.rowActions}>
            <Pressable
              style={[styles.primaryBtn, styles.flexBtn, busy && styles.btnDisabled]}
              onPress={() => void onCreate()}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryBtnText}>Save FAQ</Text>
              )}
            </Pressable>
            <Pressable
              style={[styles.secondaryBtn, styles.flexBtn]}
              onPress={() => {
                setShowForm(false);
                setQuestion('');
                setAnswer('');
              }}
              disabled={busy}
            >
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Text style={styles.section}>Entries</Text>
      {entries.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No training items yet</Text>
          <Text style={styles.meta}>
            Add an FAQ so this employee can answer common questions consistently.
          </Text>
        </View>
      ) : (
        <>
          {pageEntries.map((entry) => (
            <View key={entry.id} style={styles.card}>
              <Text style={styles.cardTitle}>{entry.title}</Text>
              <Text style={styles.meta}>
                {entry.type} · {entry.charCount} chars
                {entry.enabled ? '' : ' · Disabled'}
              </Text>
              {entry.preview ? <Text style={styles.meta}>{entry.preview}</Text> : null}
              <Pressable
                style={styles.smallDanger}
                onPress={() => confirmDelete(entry.id, entry.title)}
                disabled={busy}
              >
                <Text style={styles.smallDangerText}>Delete</Text>
              </Pressable>
            </View>
          ))}
          <ListPager
            page={page}
            totalPages={totalPages}
            totalItems={entries.length}
            onChangePage={setPage}
          />
        </>
      )}
    </ScrollView>
  );
}

export default function EmployeeTrainingScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const workerId = typeof params.id === 'string' ? params.id : '';

  return (
    <ScreenShell title="Training" subtitle="FAQs and knowledge for this employee." showBack scroll={false}>
      <CloudFeatureGate feature="aiva">
        {workerId ? (
          <TrainingBody workerId={workerId} />
        ) : (
          <ErrorRetryCard message="Missing employee id." onRetry={() => undefined} />
        )}
      </CloudFeatureGate>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: spacing.sm, paddingBottom: spacing.xl },
  section: {
    color: colors.amber,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginTop: spacing.md,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.inkMid,
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.inkMid,
  },
  emptyTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  cardTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  meta: {
    color: colors.silver,
    fontSize: 13,
    lineHeight: 18,
  },
  metric: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  label: {
    color: colors.amber,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    color: colors.white,
    backgroundColor: colors.ink,
    fontSize: 15,
  },
  textarea: {
    minHeight: 96,
    paddingTop: spacing.sm,
  },
  rowActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flexBtn: { flex: 1 },
  smallDanger: {
    minHeight: 40,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  smallDangerText: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: 13,
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

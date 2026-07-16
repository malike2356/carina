import * as WebBrowser from 'expo-web-browser';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  approveAutomationRun,
  createWorkerAutomation,
  isPlanUpgradeError,
  listAutomationRuns,
  listWorkerAutomations,
  planGateFromError,
  testWorkerAutomation,
  toggleWorkerAutomation,
  validateCreateAutomationInput,
  type AivaAutomation,
  type AivaAutomationRun,
  type AivaSchedulePreset,
  type PlanGateInfo,
} from '@/api/aiva-automations';
import { startAivaCheckout } from '@/api/aiva-billing';
import { AivaApiError } from '@/api/aiva-client';
import { AivaEmployeeSectionNav } from '@/components/AivaEmployeeSectionNav';
import { CloudFeatureGate } from '@/components/CloudFeatureGate';
import { ErrorRetryCard } from '@/components/ErrorRetryCard';
import { LoadingPanel } from '@/components/LoadingPanel';
import { ScreenShell } from '@/components/ScreenShell';
import { isApiAuthError } from '@/lib/cloud-features';
import { useAuth } from '@/store/auth-store';
import { colors, radii, spacing } from '@/theme/tokens';

const SCHEDULE_PRESETS: { id: AivaSchedulePreset; label: string }[] = [
  { id: 'daily', label: 'Daily 09:00' },
  { id: 'weekly', label: 'Weekly Mon 09:00' },
  { id: 'monthly', label: 'Monthly 1st 09:00' },
  { id: 'interval_30', label: 'Every 30 min' },
  { id: 'custom', label: 'Custom text' },
];

const ACTION_TYPES = [
  { id: 'aiva_prompt', label: 'Aiva prompt' },
  { id: 'playbook', label: 'Playbook' },
  { id: 'webhook_call', label: 'Webhook' },
];

const APPROVAL_MODES = [
  { id: 'require_write', label: 'Approve writes' },
  { id: 'always', label: 'Always approve' },
  { id: 'never', label: 'Never approve' },
];

function formatWhen(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function AutomationsBody({ workerId }: { workerId: string }) {
  const { instance, gatewayAuth } = useAuth();
  const [automations, setAutomations] = useState<AivaAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [planGate, setPlanGate] = useState<PlanGateInfo | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [runs, setRuns] = useState<AivaAutomationRun[]>([]);
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [schedulePreset, setSchedulePreset] = useState<AivaSchedulePreset>('daily');
  const [scheduleText, setScheduleText] = useState('');
  const [actionType, setActionType] = useState('aiva_prompt');
  const [approvalMode, setApprovalMode] = useState('require_write');
  const [webhookUrl, setWebhookUrl] = useState('');

  const refresh = useCallback(
    async (mode: 'full' | 'soft' = 'full') => {
      if (!instance?.baseUrl || !gatewayAuth?.apiKey) {
        setError('Sign in to Carina Cloud to manage automations.');
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
        const next = await listWorkerAutomations(instance.baseUrl, workerId, gatewayAuth);
        setAutomations(next);
      } catch (err) {
        if (isPlanUpgradeError(err)) {
          setPlanGate(planGateFromError(err));
          setAutomations([]);
          setError(null);
        } else {
          const message = err instanceof Error ? err.message : String(err);
          const status = err instanceof AivaApiError ? err.status : 0;
          setError(message);
          setSessionExpired(isApiAuthError(message) || status === 401);
          if (mode === 'full') setAutomations([]);
        }
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
      const tier = planGate?.planRequired === 'business' ? 'business' : 'team';
      const url = await startAivaCheckout(instance.baseUrl, tier, gatewayAuth);
      await WebBrowser.openBrowserAsync(url);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setCheckoutBusy(false);
    }
  }, [checkoutBusy, gatewayAuth, instance?.baseUrl, planGate?.planRequired]);

  const onToggle = useCallback(
    async (item: AivaAutomation) => {
      if (!instance?.baseUrl || !gatewayAuth?.apiKey || busyId) return;
      setBusyId(item.id);
      setActionError(null);
      const nextEnabled = !item.enabled;
      setAutomations((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, enabled: nextEnabled } : row)),
      );
      try {
        await toggleWorkerAutomation(
          instance.baseUrl,
          workerId,
          item.id,
          nextEnabled,
          gatewayAuth,
        );
      } catch (err) {
        setAutomations((prev) =>
          prev.map((row) => (row.id === item.id ? { ...row, enabled: item.enabled } : row)),
        );
        setActionError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusyId(null);
      }
    },
    [busyId, gatewayAuth, instance?.baseUrl, workerId],
  );

  const loadRuns = useCallback(
    async (automationId: string) => {
      if (!instance?.baseUrl || !gatewayAuth?.apiKey) return;
      setHistoryId(automationId);
      setActionError(null);
      try {
        const next = await listAutomationRuns(
          instance.baseUrl,
          workerId,
          automationId,
          gatewayAuth,
        );
        setRuns(next);
      } catch (err) {
        setRuns([]);
        setActionError(err instanceof Error ? err.message : String(err));
      }
    },
    [gatewayAuth, instance?.baseUrl, workerId],
  );

  const onTest = useCallback(
    async (automationId: string) => {
      if (!instance?.baseUrl || !gatewayAuth?.apiKey || busyId) return;
      setBusyId(automationId);
      setActionError(null);
      try {
        await testWorkerAutomation(instance.baseUrl, workerId, automationId, gatewayAuth);
        await loadRuns(automationId);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusyId(null);
      }
    },
    [busyId, gatewayAuth, instance?.baseUrl, loadRuns, workerId],
  );

  const onApproveRun = useCallback(
    async (runId: string) => {
      if (!instance?.baseUrl || !gatewayAuth?.apiKey || !historyId || busyId) return;
      setBusyId(runId);
      setActionError(null);
      try {
        await approveAutomationRun(instance.baseUrl, workerId, runId, gatewayAuth);
        await loadRuns(historyId);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusyId(null);
      }
    },
    [busyId, gatewayAuth, historyId, instance?.baseUrl, loadRuns, workerId],
  );

  const resetForm = useCallback(() => {
    setName('');
    setDescription('');
    setSchedulePreset('daily');
    setScheduleText('');
    setActionType('aiva_prompt');
    setApprovalMode('require_write');
    setWebhookUrl('');
    setShowForm(false);
  }, []);

  const onCreate = useCallback(async () => {
    if (!instance?.baseUrl || !gatewayAuth?.apiKey || creating) return;
    const input = {
      name,
      description,
      triggerKind: 'schedule' as const,
      schedulePreset,
      scheduleText,
      actionType,
      approvalMode,
      webhookUrl,
    };
    const validation = validateCreateAutomationInput(input);
    if (validation) {
      setActionError(validation);
      return;
    }
    setCreating(true);
    setActionError(null);
    try {
      const created = await createWorkerAutomation(
        instance.baseUrl,
        workerId,
        input,
        gatewayAuth,
      );
      setAutomations((prev) => [created, ...prev]);
      resetForm();
    } catch (err) {
      if (isPlanUpgradeError(err)) {
        setPlanGate(planGateFromError(err));
      } else {
        setActionError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setCreating(false);
    }
  }, [
    actionType,
    approvalMode,
    creating,
    description,
    gatewayAuth,
    instance?.baseUrl,
    name,
    resetForm,
    schedulePreset,
    scheduleText,
    webhookUrl,
    workerId,
  ]);

  if (loading) return <LoadingPanel label="Loading automations..." />;

  if (sessionExpired || (error && automations.length === 0 && !planGate)) {
    return (
      <ErrorRetryCard
        message={error ?? 'Could not load automations.'}
        onRetry={() => void refresh('full')}
        retryLabel={sessionExpired ? 'Sign in again' : 'Retry'}
      />
    );
  }

  if (planGate?.required) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Team plan required</Text>
          <Text style={styles.meta}>
            {planGate.message ??
              'Automations need a Team plan or higher. Upgrade to schedule recurring Aiva work.'}
          </Text>
          {planGate.planTier ? (
            <Text style={styles.meta}>Current plan: {planGate.planTier}</Text>
          ) : null}
          <Pressable
            style={[styles.primaryBtn, checkoutBusy && styles.btnDisabled]}
            onPress={() => void openUpgrade()}
            disabled={checkoutBusy}
            accessibilityRole="button"
            accessibilityLabel="Upgrade plan"
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
        </View>
        {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
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
          tintColor={colors.teal}
        />
      }
    >
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
          accessibilityLabel="Create automation"
        >
          <Text style={styles.primaryBtnText}>Create automation</Text>
        </Pressable>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>New automation</Text>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Daily inbox brief"
            placeholderTextColor={colors.silverMid}
            editable={!creating}
          />
          <Text style={styles.label}>Description / prompt</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Summarise new emails and draft replies"
            placeholderTextColor={colors.silverMid}
            multiline
            textAlignVertical="top"
            editable={!creating}
          />
          <Text style={styles.label}>Schedule</Text>
          <View style={styles.chipRow}>
            {SCHEDULE_PRESETS.map((preset) => (
              <Pressable
                key={preset.id}
                style={[styles.chip, schedulePreset === preset.id && styles.chipActive]}
                onPress={() => setSchedulePreset(preset.id)}
                disabled={creating}
              >
                <Text
                  style={[styles.chipText, schedulePreset === preset.id && styles.chipTextActive]}
                >
                  {preset.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {schedulePreset === 'custom' ? (
            <TextInput
              style={styles.input}
              value={scheduleText}
              onChangeText={setScheduleText}
              placeholder="Every weekday at 8am"
              placeholderTextColor={colors.silverMid}
              editable={!creating}
            />
          ) : null}
          <Text style={styles.label}>Action</Text>
          <View style={styles.chipRow}>
            {ACTION_TYPES.map((item) => (
              <Pressable
                key={item.id}
                style={[styles.chip, actionType === item.id && styles.chipActive]}
                onPress={() => setActionType(item.id)}
                disabled={creating}
              >
                <Text style={[styles.chipText, actionType === item.id && styles.chipTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {actionType === 'webhook_call' ? (
            <TextInput
              style={styles.input}
              value={webhookUrl}
              onChangeText={setWebhookUrl}
              placeholder="https://example.com/hook"
              placeholderTextColor={colors.silverMid}
              autoCapitalize="none"
              editable={!creating}
            />
          ) : null}
          <Text style={styles.label}>Approval</Text>
          <View style={styles.chipRow}>
            {APPROVAL_MODES.map((item) => (
              <Pressable
                key={item.id}
                style={[styles.chip, approvalMode === item.id && styles.chipActive]}
                onPress={() => setApprovalMode(item.id)}
                disabled={creating}
              >
                <Text
                  style={[styles.chipText, approvalMode === item.id && styles.chipTextActive]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.rowActions}>
            <Pressable
              style={[styles.primaryBtn, styles.flexBtn, creating && styles.btnDisabled]}
              onPress={() => void onCreate()}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryBtnText}>Save</Text>
              )}
            </Pressable>
            <Pressable style={[styles.secondaryBtn, styles.flexBtn]} onPress={resetForm}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Text style={styles.section}>Automations</Text>
      {automations.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No automations yet</Text>
          <Text style={styles.meta}>
            Create a daily Aiva prompt schedule to run recurring work without opening the website.
          </Text>
        </View>
      ) : (
        automations.map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.meta}>{item.scheduleLabel}</Text>
            {item.description ? <Text style={styles.meta}>{item.description}</Text> : null}
            <Text style={styles.meta}>
              {item.enabled ? 'Enabled' : 'Disabled'} · Last run {formatWhen(item.lastRunAt)}
            </Text>
            <View style={styles.rowActions}>
              <Pressable
                style={styles.smallBtn}
                onPress={() => void onToggle(item)}
                disabled={busyId === item.id}
              >
                <Text style={styles.smallBtnText}>{item.enabled ? 'Disable' : 'Enable'}</Text>
              </Pressable>
              <Pressable
                style={styles.smallBtn}
                onPress={() => void onTest(item.id)}
                disabled={busyId === item.id}
              >
                <Text style={styles.smallBtnText}>Test run</Text>
              </Pressable>
              <Pressable style={styles.smallBtn} onPress={() => void loadRuns(item.id)}>
                <Text style={styles.smallBtnText}>History</Text>
              </Pressable>
            </View>
            {historyId === item.id ? (
              <View style={styles.historyBlock}>
                <Text style={styles.label}>Recent runs</Text>
                {runs.length === 0 ? (
                  <Text style={styles.meta}>No runs yet.</Text>
                ) : (
                  runs.map((run) => (
                    <View key={run.id} style={styles.runRow}>
                      <Text style={styles.meta}>
                        {run.status}
                        {run.approvalStatus ? ` · ${run.approvalStatus}` : ''}
                      </Text>
                      <Text style={styles.meta}>{formatWhen(run.createdAt)}</Text>
                      {run.error ? <Text style={styles.error}>{run.error}</Text> : null}
                      {run.approvalStatus === 'awaiting_approval' ? (
                        <Pressable
                          style={styles.smallBtn}
                          onPress={() => void onApproveRun(run.id)}
                          disabled={busyId === run.id}
                        >
                          <Text style={styles.smallBtnText}>Approve run</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ))
                )}
              </View>
            ) : null}
          </View>
        ))
      )}
    </ScrollView>
  );
}

export default function EmployeeAutomationsScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const workerId = typeof params.id === 'string' ? params.id : '';

  return (
    <ScreenShell title="Automations" subtitle="Schedules and recurring work." showBack scroll={false}>
      <CloudFeatureGate feature="aiva">
        {workerId ? (
          <View style={styles.screenBody}>
            <AivaEmployeeSectionNav workerId={workerId} active="automations" />
            <AutomationsBody workerId={workerId} />
          </View>
        ) : (
          <ErrorRetryCard message="Missing employee id." onRetry={() => undefined} />
        )}
      </CloudFeatureGate>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  screenBody: { flex: 1, minHeight: 0, gap: spacing.sm },
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  chipActive: {
    borderColor: colors.teal,
    backgroundColor: colors.ink,
  },
  chipText: {
    color: colors.silver,
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.tealLight,
  },
  rowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  flexBtn: { flex: 1, minWidth: 120 },
  smallBtn: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  smallBtnText: {
    color: colors.tealLight,
    fontWeight: '600',
    fontSize: 13,
  },
  historyBlock: {
    marginTop: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderDim,
    paddingTop: spacing.sm,
  },
  runRow: {
    gap: 2,
    paddingVertical: spacing.xs,
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

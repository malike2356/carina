import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  AivaApiError,
  assignAivaEmployeeTask,
  dismissAivaWorker,
  fetchAivaSubscriptionStatus,
  getAivaWorker,
  listAivaEmployeeMessages,
  listAivaEmployeeTasks,
  pauseAivaWorker,
  patchAivaWorker,
  resumeAivaWorker,
  sendAivaEmployeeMessage,
  type AivaSubscriptionStatus,
  type AivaEmployeeMessage,
  type AivaEmployeeTask,
  type AivaWorkerDetail,
} from '@/api/aiva-client';
import { CloudFeatureGate } from '@/components/CloudFeatureGate';
import { ErrorRetryCard } from '@/components/ErrorRetryCard';
import { LoadingPanel } from '@/components/LoadingPanel';
import { ScreenShell } from '@/components/ScreenShell';
import {
  applyWorkerStatus,
  buildAivaUsageGlance,
  mapAivaWorkerDetailOverview,
  resolvePauseResumeStatus,
} from '@/lib/aiva-employee-detail';
import { isApiAuthError } from '@/lib/cloud-features';
import { useAuth } from '@/store/auth-store';
import { colors, radii, spacing } from '@/theme/tokens';

function EmployeeDetailBody({ workerId }: { workerId: string }) {
  const { instance, gatewayAuth } = useAuth();
  const [worker, setWorker] = useState<AivaWorkerDetail | null>(null);
  const [subscription, setSubscription] = useState<AivaSubscriptionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [directMessages, setDirectMessages] = useState<AivaEmployeeMessage[]>([]);
  const [directTasks, setDirectTasks] = useState<AivaEmployeeTask[]>([]);
  const [directMessage, setDirectMessage] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskInstructions, setTaskInstructions] = useState('');

  const load = useCallback(async () => {
    if (!instance?.baseUrl || !gatewayAuth?.apiKey) {
      setError('Sign in to Carina Cloud to view this employee.');
      setSessionExpired(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setActionError(null);
    setSessionExpired(false);
    setNotFound(false);
    try {
      const [detail, status] = await Promise.all([
        getAivaWorker(instance.baseUrl, workerId, gatewayAuth),
        fetchAivaSubscriptionStatus(instance.baseUrl, gatewayAuth).catch(() => null),
      ]);
      setWorker(detail);
      setSubscription(status);
      setEditName(detail.name);
      setEditRole(detail.roleDescription);
      const [messages, tasks] = await Promise.all([
        listAivaEmployeeMessages(instance.baseUrl, workerId, gatewayAuth).catch(() => []),
        listAivaEmployeeTasks(instance.baseUrl, workerId, gatewayAuth).catch(() => []),
      ]);
      setDirectMessages(messages);
      setDirectTasks(tasks);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = err instanceof AivaApiError ? err.status : 0;
      setWorker(null);
      setError(message);
      setSessionExpired(isApiAuthError(message) || status === 401);
      setNotFound(status === 404);
    } finally {
      setLoading(false);
    }
  }, [gatewayAuth, instance?.baseUrl, workerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const togglePause = useCallback(async () => {
    if (!worker || !instance?.baseUrl || !gatewayAuth?.apiKey || busy) return;
    const action = worker.status === 'paused' ? 'resume' : 'pause';
    if (action === 'pause') {
      const confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Pause employee?',
          'Message processing will stop until you resume.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Pause', style: 'destructive', onPress: () => resolve(true) },
          ],
        );
      });
      if (!confirmed) return;
    }

    const previous = worker.status;
    const optimistic = resolvePauseResumeStatus({
      previous,
      action,
      outcome: 'success',
    });
    setWorker(applyWorkerStatus(worker, optimistic));
    setBusy(true);
    setActionError(null);
    try {
      const updated =
        action === 'pause'
          ? await pauseAivaWorker(instance.baseUrl, worker.id, gatewayAuth)
          : await resumeAivaWorker(instance.baseUrl, worker.id, gatewayAuth);
      setWorker(updated);
      setEditName(updated.name);
      setEditRole(updated.roleDescription);
    } catch (err) {
      setWorker(
        applyWorkerStatus(
          worker,
          resolvePauseResumeStatus({ previous, action, outcome: 'failure' }),
        ),
      );
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [busy, gatewayAuth, instance?.baseUrl, worker]);

  const saveEdits = useCallback(async () => {
    if (!worker || !instance?.baseUrl || !gatewayAuth?.apiKey || busy) return;
    const roleName = editName.trim();
    const roleDescription = editRole.trim();
    if (!roleName || !roleDescription) {
      setActionError('Name and role description are required.');
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const updated = await patchAivaWorker(
        instance.baseUrl,
        worker.id,
        { roleName, roleDescription },
        gatewayAuth,
      );
      setWorker(updated);
      setEditName(updated.name);
      setEditRole(updated.roleDescription);
      setEditing(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [busy, editName, editRole, gatewayAuth, instance?.baseUrl, worker]);

  const confirmDismiss = useCallback(() => {
    if (!worker || !instance?.baseUrl || !gatewayAuth?.apiKey || busy) return;
    Alert.alert(
      'Dismiss employee?',
      `${worker.name} will be removed from your workspace.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Dismiss',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true);
              setActionError(null);
              try {
                await dismissAivaWorker(instance.baseUrl, worker.id, gatewayAuth);
                router.replace('/(tabs)/employees' as Href);
              } catch (err) {
                setActionError(err instanceof Error ? err.message : String(err));
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  }, [busy, gatewayAuth, instance?.baseUrl, worker]);

  const sendDirect = useCallback(async () => {
    if (!worker || !instance?.baseUrl || !gatewayAuth?.apiKey || busy) return;
    const content = directMessage.trim();
    if (!content) return;
    setBusy(true);
    setActionError(null);
    try {
      await sendAivaEmployeeMessage(instance.baseUrl, worker.id, content, gatewayAuth);
      setDirectMessage('');
      const messages = await listAivaEmployeeMessages(instance.baseUrl, worker.id, gatewayAuth);
      setDirectMessages(messages);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [busy, directMessage, gatewayAuth, instance?.baseUrl, worker]);

  const assignDirectTask = useCallback(async () => {
    if (!worker || !instance?.baseUrl || !gatewayAuth?.apiKey || busy) return;
    const title = taskTitle.trim();
    const instructions = taskInstructions.trim();
    if (!title || !instructions) {
      setActionError('Task title and instructions are required.');
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await assignAivaEmployeeTask(
        instance.baseUrl,
        worker.id,
        { title, instructions, priority: 'normal' },
        gatewayAuth,
      );
      setTaskTitle('');
      setTaskInstructions('');
      const tasks = await listAivaEmployeeTasks(instance.baseUrl, worker.id, gatewayAuth);
      setDirectTasks(tasks);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [busy, gatewayAuth, instance?.baseUrl, taskInstructions, taskTitle, worker]);

  if (loading) {
    return <LoadingPanel label="Loading employee" />;
  }

  if (error || !worker) {
    return (
      <ErrorRetryCard
        message={
          sessionExpired
            ? 'Your Carina Cloud session expired. Sign in again to continue.'
            : notFound
              ? 'Employee not found. It may have been dismissed.'
              : error ?? 'Could not load employee.'
        }
        onRetry={() => {
          if (sessionExpired) {
            router.replace({ pathname: '/(auth)/login', params: { expired: '1' } });
            return;
          }
          if (notFound) {
            router.replace('/(tabs)/employees' as Href);
            return;
          }
          void load();
        }}
        retryLabel={sessionExpired ? 'Sign in again' : notFound ? 'Back to employees' : 'Retry'}
      />
    );
  }

  const overview = mapAivaWorkerDetailOverview(worker);
  const usage = buildAivaUsageGlance(worker, subscription);
  const pauseLabel = overview.canResume ? 'Resume' : 'Pause';

  return (
    <View style={styles.block}>
      <View style={styles.headerCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{overview.initials}</Text>
        </View>
        <View style={styles.headerBody}>
          <Text style={styles.name} numberOfLines={2}>
            {overview.name}
          </Text>
          <View style={[styles.chip, { borderColor: overview.chip.color }]}>
            <View style={[styles.chipDot, { backgroundColor: overview.chip.color }]} />
            <Text style={[styles.chipText, { color: overview.chip.color }]}>
              {overview.chip.label}
            </Text>
          </View>
          {overview.roleDescription ? (
            <Text style={styles.role} numberOfLines={3}>
              {overview.roleDescription}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Usage</Text>
        <Text style={styles.metric}>
          {usage.messagesToday} message{usage.messagesToday === 1 ? '' : 's'} today
        </Text>
        <Text style={styles.meta}>
          {usage.totalMessages} total
          {usage.pendingApprovals > 0 ? ` · ${usage.pendingApprovals} pending approval(s)` : ''}
        </Text>
        {usage.creditLine ? <Text style={styles.credit}>{usage.creditLine}</Text> : null}
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.primaryBtn, busy && styles.btnDisabled]}
          onPress={() => void togglePause()}
          disabled={busy || (!overview.canPause && !overview.canResume)}
          accessibilityRole="button"
          accessibilityLabel={pauseLabel}
        >
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryBtnText}>{pauseLabel}</Text>
          )}
        </Pressable>
        <Pressable
          style={styles.secondaryBtn}
          onPress={() => router.push(`/employee/${worker.id}/channels` as Href)}
          accessibilityRole="button"
          accessibilityLabel="Connect channel"
        >
          <Text style={styles.secondaryBtnText}>Connect channel</Text>
        </Pressable>
      </View>

      {actionError ? <Text style={styles.error}>{actionError}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.label}>Direct work</Text>
        <Text style={styles.meta}>
          Chat with {worker.name} and assign work without opening WhatsApp, Slack, or email.
        </Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={directMessage}
          onChangeText={setDirectMessage}
          placeholder="Message this employee"
          placeholderTextColor={colors.silverMid}
          multiline
          textAlignVertical="top"
          editable={!busy}
        />
        <Pressable
          style={[styles.primaryBtn, busy && styles.btnDisabled]}
          onPress={() => void sendDirect()}
          disabled={busy || !directMessage.trim()}
        >
          <Text style={styles.primaryBtnText}>Send message</Text>
        </Pressable>
        {directMessages.length > 0 ? (
          <View style={styles.threadList}>
            {directMessages.slice(-4).map((item) => (
              <View
                key={item.id}
                style={[
                  styles.messageBubble,
                  item.sender === 'user' ? styles.userBubble : styles.employeeBubble,
                ]}
              >
                <Text style={styles.messageText}>{item.content}</Text>
                <Text style={styles.messageMeta}>{item.sender === 'user' ? 'You' : worker.name}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Assign task</Text>
        <TextInput
          style={styles.input}
          value={taskTitle}
          onChangeText={setTaskTitle}
          placeholder="Task title"
          placeholderTextColor={colors.silverMid}
          editable={!busy}
        />
        <TextInput
          style={[styles.input, styles.textarea]}
          value={taskInstructions}
          onChangeText={setTaskInstructions}
          placeholder="Instructions and expected output"
          placeholderTextColor={colors.silverMid}
          multiline
          textAlignVertical="top"
          editable={!busy}
        />
        <Pressable
          style={[styles.primaryBtn, busy && styles.btnDisabled]}
          onPress={() => void assignDirectTask()}
          disabled={busy || !taskTitle.trim() || !taskInstructions.trim()}
        >
          <Text style={styles.primaryBtnText}>Assign task</Text>
        </Pressable>
        {directTasks.length > 0 ? (
          <View style={styles.taskList}>
            {directTasks.slice(0, 5).map((task) => (
              <View key={task.id} style={styles.taskRow}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                <Text style={styles.taskMeta}>
                  {task.priority} · {task.status}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.meta}>No assigned work yet.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Sections</Text>
        <Text style={styles.sectionActive}>Overview</Text>
        <Pressable onPress={() => router.push(`/employee/${worker.id}/channels` as Href)}>
          <Text style={styles.sectionLink}>Channels</Text>
        </Pressable>
        <Pressable onPress={() => router.push(`/employee/${worker.id}/training` as Href)}>
          <Text style={styles.sectionLink}>Training</Text>
        </Pressable>
        <Pressable onPress={() => router.push(`/employee/${worker.id}/automations` as Href)}>
          <Text style={styles.sectionLink}>Automations</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Settings</Text>
        {editing ? (
          <>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Display name"
              placeholderTextColor={colors.silverMid}
              editable={!busy}
            />
            <TextInput
              style={[styles.input, styles.textarea]}
              value={editRole}
              onChangeText={setEditRole}
              placeholder="Role description"
              placeholderTextColor={colors.silverMid}
              multiline
              textAlignVertical="top"
              editable={!busy}
            />
            <View style={styles.editActions}>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => {
                  setEditing(false);
                  setEditName(worker.name);
                  setEditRole(worker.roleDescription);
                }}
                disabled={busy}
              >
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryBtn, styles.editSave, busy && styles.btnDisabled]}
                onPress={() => void saveEdits()}
                disabled={busy}
              >
                <Text style={styles.primaryBtnText}>Save</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Pressable
              style={styles.linkRow}
              onPress={() => setEditing(true)}
              accessibilityRole="button"
            >
              <Text style={styles.linkText}>Edit name and role</Text>
            </Pressable>
            <Pressable
              style={styles.linkRow}
              onPress={confirmDismiss}
              accessibilityRole="button"
            >
              <Text style={styles.dangerText}>Dismiss employee</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

export default function EmployeeDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const workerId = typeof params.id === 'string' ? params.id : '';

  return (
    <ScreenShell title="Employee" subtitle="Overview" showBack scroll>
      <CloudFeatureGate feature="aiva">
        {workerId ? (
          <EmployeeDetailBody workerId={workerId} />
        ) : (
          <ErrorRetryCard
            message="Missing employee id."
            onRetry={() => router.replace('/(tabs)/employees' as Href)}
            retryLabel="Back to employees"
          />
        )}
      </CloudFeatureGate>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.md },
  headerCard: {
    flexDirection: 'row',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.lg,
    padding: spacing.md,
    backgroundColor: colors.inkMid,
    alignItems: 'flex-start',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.inkLift,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.tealLight,
    fontSize: 20,
    fontWeight: '700',
  },
  headerBody: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  name: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '700',
  },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  role: {
    color: colors.silver,
    fontSize: 13,
    lineHeight: 18,
  },
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
  metric: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '600',
  },
  meta: {
    color: colors.silver,
    fontSize: 13,
    lineHeight: 18,
  },
  credit: {
    color: colors.amber,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  threadList: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  messageBubble: {
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  userBubble: {
    backgroundColor: colors.teal,
    alignSelf: 'flex-end',
    maxWidth: '88%',
  },
  employeeBubble: {
    backgroundColor: colors.inkLift,
    alignSelf: 'flex-start',
    maxWidth: '88%',
  },
  messageText: {
    color: colors.white,
    fontSize: 13,
    lineHeight: 18,
  },
  messageMeta: {
    color: colors.silver,
    fontSize: 11,
    marginTop: 4,
  },
  taskList: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  taskRow: {
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.md,
    padding: spacing.sm,
    backgroundColor: colors.inkLift,
  },
  taskTitle: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  taskMeta: {
    color: colors.silver,
    fontSize: 12,
    marginTop: 3,
  },
  actions: {
    gap: spacing.sm,
  },
  primaryBtn: {
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
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
    paddingHorizontal: spacing.md,
  },
  secondaryBtnText: {
    color: colors.tealLight,
    fontWeight: '700',
    fontSize: 15,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionActive: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: spacing.sm,
  },
  sectionLink: {
    color: colors.tealLight,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: spacing.sm,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.white,
    backgroundColor: colors.ink,
    fontSize: 15,
    marginTop: spacing.xs,
  },
  textarea: {
    minHeight: 96,
  },
  editActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  editSave: {
    flex: 1,
  },
  linkRow: {
    minHeight: 44,
    justifyContent: 'center',
  },
  linkText: {
    color: colors.tealLight,
    fontWeight: '600',
    fontSize: 14,
  },
  dangerText: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: 14,
  },
});

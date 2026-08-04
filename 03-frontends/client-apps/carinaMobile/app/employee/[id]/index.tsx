import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  AivaApiError,
  assignAivaEmployeeTask,
  dismissAivaWorker,
  getAivaWorker,
  listAivaEmployeeMessages,
  listAivaEmployeeTasks,
  pauseAivaWorker,
  patchAivaWorker,
  resumeAivaWorker,
  sendAivaEmployeeMessage,
  type AivaEmployeeMessage,
  type AivaEmployeeTask,
  type AivaWorkerDetail,
} from '@/api/aiva-client';
import { AivaOversightPanel } from '@/components/AivaOversightPanel';
import { AivaWorkerChatPanel } from '@/components/AivaWorkerChatPanel';
import { CloudFeatureGate } from '@/components/CloudFeatureGate';
import { ErrorRetryCard } from '@/components/ErrorRetryCard';
import { LoadingPanel } from '@/components/LoadingPanel';
import { ScreenShell } from '@/components/ScreenShell';
import {
  applyWorkerStatus,
  mapAivaWorkerDetailOverview,
  resolvePauseResumeStatus,
} from '@/lib/aiva-employee-detail';
import { AIVA_WORKER_TABS, parseAivaWorkerTab, type AivaWorkerTabId } from '@/lib/aiva-worker-tabs';
import { isApiAuthError } from '@/lib/cloud-features';
import { useAuth } from '@/store/auth-store';
import { colors, radii, spacing } from '@/theme/tokens';

function WorkerDetailBody({
  workerId,
  initialTab,
}: {
  workerId: string;
  initialTab: AivaWorkerTabId;
}) {
  const { instance, gatewayAuth } = useAuth();
  const [tab, setTab] = useState<AivaWorkerTabId>(initialTab);
  const [worker, setWorker] = useState<AivaWorkerDetail | null>(null);
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
      setError('Sign in to continue.');
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
      const detail = await getAivaWorker(instance.baseUrl, workerId, gatewayAuth);
      setWorker(detail);
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

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const selectTab = useCallback(
    (next: AivaWorkerTabId) => {
      setTab(next);
      router.setParams({ tab: next });
    },
    [],
  );

  const togglePause = useCallback(async () => {
    if (!worker || !instance?.baseUrl || !gatewayAuth?.apiKey || busy) return;
    const action = worker.status === 'paused' ? 'resume' : 'pause';
    if (action === 'pause') {
      const confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Pause worker?',
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
    setWorker(applyWorkerStatus(worker, resolvePauseResumeStatus({ previous, action, outcome: 'success' })));
    setBusy(true);
    setActionError(null);
    try {
      const updated =
        action === 'pause'
          ? await pauseAivaWorker(instance.baseUrl, worker.id, gatewayAuth)
          : await resumeAivaWorker(instance.baseUrl, worker.id, gatewayAuth);
      setWorker(updated);
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
    Alert.alert('Fire worker?', `${worker.name} will be removed from your workspace.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Fire',
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
    ]);
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

  const overview = useMemo(
    () => (worker ? mapAivaWorkerDetailOverview(worker) : null),
    [worker],
  );

  if (loading) {
    return <LoadingPanel label="Loading worker" />;
  }

  if (error || !worker || !overview) {
    return (
      <ErrorRetryCard
        message={
          sessionExpired
            ? 'Your session expired. Sign in again to continue.'
            : notFound
              ? 'Worker not found. They may have been removed.'
              : error ?? 'Could not load worker.'
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
        retryLabel={sessionExpired ? 'Sign in again' : notFound ? 'Back to workers' : 'Retry'}
      />
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
        style={styles.tabsScroll}
      >
        {AIVA_WORKER_TABS.map((item) => {
          const active = item.id === tab;
          return (
            <Pressable
              key={item.id}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => selectTab(item.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {actionError ? <Text style={styles.error}>{actionError}</Text> : null}

      {tab === 'chat' ? (
        <AivaWorkerChatPanel
          worker={worker}
          messages={directMessages}
          message={directMessage}
          onMessageChange={setDirectMessage}
          onSend={() => void sendDirect()}
          busy={busy}
        />
      ) : null}

      {tab === 'oversight' && instance?.baseUrl ? (
        <ScrollView contentContainerStyle={styles.scrollBody}>
          <AivaOversightPanel
            worker={worker}
            baseUrl={instance.baseUrl}
            auth={gatewayAuth}
          />
        </ScrollView>
      ) : null}

      {tab === 'tasks' ? (
        <ScrollView contentContainerStyle={styles.scrollBody}>
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
                {directTasks.slice(0, 8).map((task) => (
                  <View key={task.id} style={styles.taskRow}>
                    <Text style={styles.taskTitle}>{task.title}</Text>
                    <Text style={styles.meta}>
                      {task.priority} · {task.status}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.meta}>No assigned work yet.</Text>
            )}
          </View>
        </ScrollView>
      ) : null}

      {tab === 'tools' ? (
        <ScrollView contentContainerStyle={styles.scrollBody}>
          <View style={styles.card}>
            <Text style={styles.label}>Tools and channels</Text>
            <Text style={styles.meta}>
              Connect email, WhatsApp, Slack, and more so {worker.name} can work outside the app.
            </Text>
            <Pressable
              style={styles.primaryBtn}
              onPress={() => router.push(`/employee/${worker.id}/channels` as Href)}
            >
              <Text style={styles.primaryBtnText}>Open tools</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : null}

      {tab === 'knowledge' ? (
        <ScrollView contentContainerStyle={styles.scrollBody}>
          <View style={styles.card}>
            <Text style={styles.label}>Knowledge</Text>
            <Text style={styles.meta}>
              Training docs and FAQ for {worker.name}.
            </Text>
            <Pressable
              style={styles.primaryBtn}
              onPress={() => router.push(`/employee/${worker.id}/training` as Href)}
            >
              <Text style={styles.primaryBtnText}>Open knowledge</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : null}

      {tab === 'settings' ? (
        <ScrollView contentContainerStyle={styles.scrollBody}>
          <View style={styles.card}>
            <Text style={styles.label}>{worker.name}</Text>
            <View style={[styles.chip, { borderColor: overview.chip.color }]}>
              <View style={[styles.chipDot, { backgroundColor: overview.chip.color }]} />
              <Text style={[styles.chipText, { color: overview.chip.color }]}>
                {overview.chip.label}
              </Text>
            </View>
            <Pressable
              style={[styles.primaryBtn, busy && styles.btnDisabled]}
              onPress={() => void togglePause()}
              disabled={busy || (!overview.canPause && !overview.canResume)}
            >
              {busy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {overview.canResume ? 'Resume' : 'Pause'}
                </Text>
              )}
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Worker profile</Text>
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
              <Pressable style={styles.linkRow} onPress={() => setEditing(true)}>
                <Text style={styles.linkText}>Edit name and role</Text>
              </Pressable>
            )}
            <Pressable style={styles.linkRow} onPress={confirmDismiss}>
              <Text style={styles.dangerText}>Fire worker</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

export default function EmployeeDetailScreen() {
  const params = useLocalSearchParams<{ id?: string; tab?: string }>();
  const workerId = typeof params.id === 'string' ? params.id : '';
  const initialTab = parseAivaWorkerTab(params.tab);

  return (
    <ScreenShell
      title="Worker"
      subtitle={initialTab === 'chat' ? undefined : 'Manage this Aiva worker.'}
      showBack
      scroll={false}
      onBack={() => router.replace('/(tabs)/employees' as Href)}
    >
      <CloudFeatureGate feature="aiva">
        {workerId ? (
          <WorkerDetailBody workerId={workerId} initialTab={initialTab} />
        ) : (
          <ErrorRetryCard
            message="Missing worker id."
            onRetry={() => router.replace('/(tabs)/employees' as Href)}
            retryLabel="Back to workers"
          />
        )}
      </CloudFeatureGate>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0, gap: spacing.sm },
  tabsScroll: { flexGrow: 0 },
  tabs: {
    gap: spacing.xs,
    paddingBottom: spacing.xs,
  },
  tab: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderDim,
    justifyContent: 'center',
    backgroundColor: colors.inkMid,
  },
  tabActive: {
    borderColor: colors.teal,
    backgroundColor: colors.inkLift,
  },
  tabText: { color: colors.silver, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: colors.tealLight },
  scrollBody: { gap: spacing.md, paddingBottom: spacing.xl },
  card: {
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.lg,
    padding: spacing.md,
    backgroundColor: colors.inkMid,
    gap: spacing.sm,
  },
  label: { color: colors.white, fontSize: 15, fontWeight: '600' },
  meta: { color: colors.silverMid, fontSize: 13, lineHeight: 18 },
  input: {
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.white,
    backgroundColor: colors.ink,
    fontSize: 15,
    minHeight: 44,
  },
  textarea: { minHeight: 96, textAlignVertical: 'top' },
  primaryBtn: {
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  primaryBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  secondaryBtn: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderDim,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  secondaryBtnText: { color: colors.tealLight, fontWeight: '600', fontSize: 14 },
  btnDisabled: { opacity: 0.5 },
  editActions: { flexDirection: 'row', gap: spacing.sm },
  editSave: { flex: 1 },
  linkRow: { minHeight: 44, justifyContent: 'center' },
  linkText: { color: colors.tealLight, fontSize: 14, fontWeight: '600' },
  dangerText: { color: '#f87171', fontSize: 14, fontWeight: '600' },
  error: { color: '#f87171', fontSize: 13 },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 12, fontWeight: '600' },
  taskList: { gap: spacing.sm },
  taskRow: {
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.md,
    padding: spacing.sm,
    backgroundColor: colors.ink,
  },
  taskTitle: { color: colors.white, fontSize: 14, fontWeight: '600' },
});

import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  assignAivaEmployeeTask,
  getAivaWorker,
  listAivaEmployeeTasks,
  type AivaEmployeeTask,
  type AivaWorkerDetail,
} from '@/api/aiva-client';
import { AivaEmployeeSectionNav } from '@/components/AivaEmployeeSectionNav';
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
import { useAuth } from '@/store/auth-store';
import { colors, radii, spacing } from '@/theme/tokens';

function EmployeeTasks({ workerId }: { workerId: string }) {
  const { instance, gatewayAuth } = useAuth();
  const [worker, setWorker] = useState<AivaWorkerDetail | null>(null);
  const [tasks, setTasks] = useState<AivaEmployeeTask[]>([]);
  const [page, setPage] = useState(1);
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!instance?.baseUrl || !gatewayAuth?.apiKey) {
      setError('Sign in to Carina Cloud to manage employee tasks.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [detail, assigned] = await Promise.all([
        getAivaWorker(instance.baseUrl, workerId, gatewayAuth),
        listAivaEmployeeTasks(instance.baseUrl, workerId, gatewayAuth),
      ]);
      setWorker(detail);
      setTasks(assigned);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [gatewayAuth, instance?.baseUrl, workerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const assign = useCallback(async () => {
    const taskTitle = title.trim();
    const taskInstructions = instructions.trim();
    if (
      !taskTitle
      || !taskInstructions
      || !worker
      || !instance?.baseUrl
      || !gatewayAuth?.apiKey
      || busy
    ) return;

    setBusy(true);
    setError(null);
    try {
      await assignAivaEmployeeTask(
        instance.baseUrl,
        worker.id,
        { title: taskTitle, instructions: taskInstructions, priority: 'normal' },
        gatewayAuth,
      );
      setTitle('');
      setInstructions('');
      const next = await listAivaEmployeeTasks(instance.baseUrl, worker.id, gatewayAuth);
      setTasks(next);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [busy, gatewayAuth, instance?.baseUrl, instructions, title, worker]);

  const totalPages = totalPagesFor(tasks.length, DEFAULT_PAGE_SIZE);
  const pageTasks = useMemo(
    () => slicePage(tasks, page, DEFAULT_PAGE_SIZE),
    [tasks, page],
  );

  if (loading) return <LoadingPanel label="Loading tasks" />;
  if (error && !worker) {
    return <ErrorRetryCard message={error} onRetry={() => void load()} />;
  }
  if (!worker) {
    return <ErrorRetryCard message="Employee not found." onRetry={() => router.back()} />;
  }

  return (
    <View style={styles.block}>
      <AivaEmployeeSectionNav workerId={worker.id} active="tasks" />

      <View style={styles.card}>
        <Text style={styles.label}>Assign new task</Text>
        <Text style={styles.meta}>
          Give {worker.name} a clear outcome and the information needed to complete it.
        </Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Task title"
          placeholderTextColor={colors.silverMid}
          editable={!busy}
        />
        <TextInput
          style={[styles.input, styles.textarea]}
          value={instructions}
          onChangeText={setInstructions}
          placeholder="Instructions and expected output"
          placeholderTextColor={colors.silverMid}
          multiline
          textAlignVertical="top"
          editable={!busy}
        />
        <Pressable
          style={[styles.primaryBtn, (busy || !title.trim() || !instructions.trim()) && styles.disabled]}
          onPress={() => void assign()}
          disabled={busy || !title.trim() || !instructions.trim()}
        >
          {busy
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.primaryBtnText}>Assign task</Text>}
        </Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.heading}>Assigned work</Text>
        <Text style={styles.count}>{tasks.length}</Text>
      </View>
      {tasks.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No tasks yet</Text>
          <Text style={styles.meta}>Assigned work will appear here.</Text>
        </View>
      ) : (
        <>
          {pageTasks.map((task) => (
            <View key={task.id} style={styles.taskCard}>
              <View style={styles.taskTop}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                <Text style={styles.status}>{task.status}</Text>
              </View>
              <Text style={styles.meta}>{task.instructions}</Text>
              <Text style={styles.taskMeta}>Priority: {task.priority}</Text>
              {task.completedWork ? (
                <View style={styles.result}>
                  <Text style={styles.resultLabel}>Result</Text>
                  <Text style={styles.meta}>{task.completedWork}</Text>
                </View>
              ) : null}
            </View>
          ))}
          <ListPager
            page={page}
            totalPages={totalPages}
            totalItems={tasks.length}
            onChangePage={setPage}
          />
        </>
      )}
    </View>
  );
}

export default function EmployeeTasksScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const workerId = typeof params.id === 'string' ? params.id : '';
  return (
    <ScreenShell title="Employee tasks" subtitle="Assign and review work" showBack scroll>
      <CloudFeatureGate feature="aiva">
        {workerId
          ? <EmployeeTasks workerId={workerId} />
          : <ErrorRetryCard message="Missing employee id." onRetry={() => router.back()} />}
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
    gap: spacing.sm,
    backgroundColor: colors.inkMid,
  },
  label: {
    color: colors.amber,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  meta: { color: colors.silver, fontSize: 13, lineHeight: 18 },
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
  },
  textarea: { minHeight: 110 },
  primaryBtn: {
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  listHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heading: { color: colors.white, fontSize: 18, fontWeight: '700' },
  count: {
    color: colors.tealLight,
    backgroundColor: colors.inkLift,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    fontSize: 12,
    fontWeight: '700',
  },
  empty: {
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.lg,
    padding: spacing.lg,
    backgroundColor: colors.inkMid,
  },
  emptyTitle: { color: colors.white, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  taskCard: {
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.inkMid,
  },
  taskTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  taskTitle: { flex: 1, color: colors.white, fontSize: 16, fontWeight: '700' },
  status: {
    color: colors.tealLight,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  taskMeta: { color: colors.silverMid, fontSize: 12 },
  result: {
    borderTopWidth: 1,
    borderTopColor: colors.borderDim,
    paddingTop: spacing.sm,
  },
  resultLabel: {
    color: colors.amber,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
});

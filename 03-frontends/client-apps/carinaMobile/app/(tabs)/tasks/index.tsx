import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { TaskCard } from '@/components/TaskCard';
import {
  DEFAULT_PAGE_SIZE,
  ListPager,
  slicePage,
  totalPagesFor,
} from '@/components/ListPager';
import { ScreenShell } from '@/components/ScreenShell';
import { useTasks } from '@/hooks/useTasks';
import { colors, spacing } from '@/theme/tokens';

export default function TasksScreen() {
  const { running, completed, loading, error, refresh } = useTasks();
  const [runningPage, setRunningPage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      setRunningPage(1);
      setCompletedPage(1);
    }, [refresh]),
  );

  const openSession = useCallback((sessionId: string) => {
    router.push({ pathname: '/(tabs)/chat', params: { sessionId } });
  }, []);

  const runningPages = totalPagesFor(running.length, DEFAULT_PAGE_SIZE);
  const completedPages = totalPagesFor(completed.length, DEFAULT_PAGE_SIZE);
  const runningSlice = useMemo(
    () => slicePage(running, runningPage, DEFAULT_PAGE_SIZE),
    [running, runningPage],
  );
  const completedSlice = useMemo(
    () => slicePage(completed, completedPage, DEFAULT_PAGE_SIZE),
    [completed, completedPage],
  );

  return (
    <ScreenShell
      title="Tasks"
      subtitle="Assigned work and actions performed by your workers."
      scroll={false}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => {
              setRunningPage(1);
              setCompletedPage(1);
              void refresh();
            }}
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

        <Text style={styles.sectionTitle}>In progress ({running.length})</Text>
        {loading && running.length === 0 ? (
          <ActivityIndicator color={colors.tealLight} style={styles.loader} />
        ) : running.length === 0 ? (
          <Text style={styles.empty}>No active tasks. Assign a task to a worker or ask Carina to take an action.</Text>
        ) : (
          <View style={styles.group}>
            {runningSlice.map((task) => (
              <TaskCard key={task.id} task={task} onOpenSession={openSession} />
            ))}
            <ListPager
              page={runningPage}
              totalPages={runningPages}
              totalItems={running.length}
              onChangePage={setRunningPage}
            />
          </View>
        )}

        <Text style={styles.sectionTitle}>Done ({completed.length})</Text>
        {completed.length === 0 ? (
          <Text style={styles.empty}>Finished work appears here with tool usage and summary.</Text>
        ) : (
          <View style={styles.group}>
            {completedSlice.map((task) => (
              <TaskCard key={task.id} task={task} onOpenSession={openSession} />
            ))}
            <ListPager
              page={completedPage}
              totalPages={completedPages}
              totalItems={completed.length}
              onChangePage={setCompletedPage}
            />
          </View>
        )}
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
  sectionTitle: {
    color: colors.amber,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  group: {
    gap: spacing.sm,
  },
  empty: {
    color: colors.silver,
    fontSize: 14,
    lineHeight: 20,
  },
  loader: {
    marginVertical: spacing.md,
  },
  errorBlock: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  retryText: {
    color: colors.tealLight,
    fontSize: 13,
    fontWeight: '600',
  },
});

import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { TaskCard } from '@/components/TaskCard';
import { ScreenShell } from '@/components/ScreenShell';
import { useTasks } from '@/hooks/useTasks';
import { colors, spacing } from '@/theme/tokens';

export default function TasksScreen() {
  const { running, completed, loading, refresh } = useTasks();

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const openSession = useCallback((sessionId: string) => {
    router.push({ pathname: '/(tabs)/chat', params: { sessionId } });
  }, []);

  return (
    <ScreenShell
      title="Tasks"
      subtitle="Work Carina runs from chat. Each prompt becomes a tracked task."
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
        <Text style={styles.sectionTitle}>Running ({running.length})</Text>
        {loading && running.length === 0 ? (
          <ActivityIndicator color={colors.tealLight} style={styles.loader} />
        ) : running.length === 0 ? (
          <Text style={styles.empty}>No active tasks. Send a message in Chat to start one.</Text>
        ) : (
          <View style={styles.group}>
            {running.map((task) => (
              <TaskCard key={task.id} task={task} onOpenSession={openSession} />
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Completed ({completed.length})</Text>
        {completed.length === 0 ? (
          <Text style={styles.empty}>Finished work appears here with tool usage and summary.</Text>
        ) : (
          <View style={styles.group}>
            {completed.map((task) => (
              <TaskCard key={task.id} task={task} onOpenSession={openSession} />
            ))}
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
});

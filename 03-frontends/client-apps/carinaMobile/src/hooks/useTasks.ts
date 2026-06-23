import { useCallback, useEffect, useState } from 'react';
import type { AgentTask } from '@/api/types';
import { loadTasks } from '@/lib/task-store';
import { syncTaskWidgetFromStore } from '@/lib/widget-sync';

export function useTasks() {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const items = await loadTasks();
    setTasks(items);
    setLoading(false);
    void syncTaskWidgetFromStore();
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const running = tasks.filter((t) => t.status === 'running');
  const completed = tasks.filter((t) => t.status === 'completed' || t.status === 'failed');

  return { tasks, running, completed, loading, refresh };
}

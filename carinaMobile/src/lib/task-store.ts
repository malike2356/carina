import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AgentTask } from '@/api/types';

const STORAGE_KEY = 'carina.agent.tasks';

export async function loadTasks(): Promise<AgentTask[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as AgentTask[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveTasks(tasks: AgentTask[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

export async function upsertTask(task: AgentTask): Promise<AgentTask[]> {
  const tasks = await loadTasks();
  const index = tasks.findIndex((item) => item.id === task.id);
  const next = [...tasks];
  if (index >= 0) {
    next[index] = task;
  } else {
    next.unshift(task);
  }
  await saveTasks(next.slice(0, 100));
  return next.slice(0, 100);
}

export async function patchTask(
  id: string,
  patch: Partial<AgentTask>,
): Promise<AgentTask[]> {
  const tasks = await loadTasks();
  const next = tasks.map((item) => (item.id === id ? { ...item, ...patch } : item));
  await saveTasks(next);
  return next;
}

import type { AgentTaskStatus } from '@/api/types';

export function truncatePrompt(prompt: string, max = 80): string {
  const trimmed = prompt.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export function buildTaskNotificationContent(
  prompt: string,
  status: Extract<AgentTaskStatus, 'completed' | 'failed'>,
): { title: string; body: string } {
  const preview = truncatePrompt(prompt);
  if (status === 'completed') {
    return {
      title: 'Carina finished',
      body: preview || 'Your task completed.',
    };
  }
  return {
    title: 'Carina task failed',
    body: preview || 'Something went wrong.',
  };
}

export function shouldNotifyForAppState(state: string): boolean {
  return state === 'background' || state === 'inactive';
}

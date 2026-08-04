export const AIVA_WORKER_TABS = [
  { id: 'chat', label: 'Chat' },
  { id: 'oversight', label: 'Oversight' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'tools', label: 'Tools' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'settings', label: 'Settings' },
] as const;

export type AivaWorkerTabId = (typeof AIVA_WORKER_TABS)[number]['id'];

export function parseAivaWorkerTab(raw: unknown): AivaWorkerTabId {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  const match = AIVA_WORKER_TABS.find((tab) => tab.id === value);
  return match?.id ?? 'chat';
}

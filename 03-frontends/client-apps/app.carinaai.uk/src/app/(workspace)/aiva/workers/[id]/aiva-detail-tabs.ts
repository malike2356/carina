// Core tabs for the Aiva worker detail page.
// Prompt 20 can append: { id: 'conversations', label: 'Conversations' }, { id: 'analytics', label: 'Analytics' }
// Prompt 28 can append: { id: 'training', label: 'Training' }
// Merge arrays when extending: [...AIVA_CORE_TABS, ...EXTRA_TABS]

export type AivaTab = {
  id: string;
  label: string;
};

export const AIVA_CORE_TABS: AivaTab[] = [
  { id: 'work', label: 'Chat' },
  { id: 'call', label: 'Call' },
  { id: 'channels', label: 'Channels' },
  { id: 'tools', label: 'Tools' },
  { id: 'training', label: 'Training' },
  { id: 'drive-docs', label: 'Drive docs' },
  { id: 'automations', label: 'Automations' },
  { id: 'overview', label: 'Oversight' },
  { id: 'settings', label: 'Settings' },
];

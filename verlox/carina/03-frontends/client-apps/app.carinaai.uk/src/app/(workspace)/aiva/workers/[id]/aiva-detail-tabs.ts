// Core tabs for the Aiva worker detail page.
// Prompt 20 can append: { id: 'conversations', label: 'Conversations' }, { id: 'analytics', label: 'Analytics' }
// Prompt 28 can append: { id: 'training', label: 'Training' }
// Merge arrays when extending: [...AIVA_CORE_TABS, ...EXTRA_TABS]

export type AivaTab = {
  id: string;
  label: string;
};

export const AIVA_CORE_TABS: AivaTab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'work', label: 'Work' },
  { id: 'channels', label: 'Channels' },
  { id: 'training', label: 'Training' },
  { id: 'automations', label: 'Automations' },
  { id: 'settings', label: 'Settings' },
];

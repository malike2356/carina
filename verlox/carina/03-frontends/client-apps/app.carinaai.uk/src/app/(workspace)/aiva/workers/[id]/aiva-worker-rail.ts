import {
  BookOpen,
  Bot,
  Brain,
  FolderOpen,
  MessageSquare,
  Mic,
  Radio,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import type { AivaTab } from './aiva-detail-tabs';

export type AivaWorkerRailItem = AivaTab & {
  icon: LucideIcon;
  disabled?: boolean;
  disabledReason?: string;
};

export const AIVA_WORKER_RAIL: AivaWorkerRailItem[] = [
  { id: 'work', label: 'Chat', icon: MessageSquare },
  { id: 'call', label: 'Call', icon: Mic },
  { id: 'channels', label: 'Channels', icon: Radio },
  { id: 'training', label: 'Training', icon: BookOpen },
  { id: 'learning', label: 'Learning', icon: Brain },
  { id: 'drive-docs', label: 'Drive docs', icon: FolderOpen },
  { id: 'automations', label: 'Automations', icon: Bot },
  { id: 'overview', label: 'Oversight', icon: ShieldCheck },
  { id: 'settings', label: 'Settings', icon: Settings },
];

// Icon rail navigation for the Aiva worker detail page (compact sidebar variant
// of AIVA_CORE_TABS in ./aiva-detail-tabs). Derived from the same tab list so the
// two navs can never drift apart.

import type { LucideIcon } from 'lucide-react';
import {
  Eye,
  FileText,
  GraduationCap,
  MessageSquare,
  Phone,
  Radio,
  Settings,
  Wrench,
  Zap,
} from 'lucide-react';
import { AIVA_CORE_TABS, type AivaTab } from './aiva-detail-tabs';

export type AivaWorkerRailItem = {
  id: AivaTab['id'];
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  disabledReason?: string;
};

const RAIL_ICONS: Record<string, LucideIcon> = {
  work: MessageSquare,
  call: Phone,
  channels: Radio,
  tools: Wrench,
  training: GraduationCap,
  'drive-docs': FileText,
  automations: Zap,
  overview: Eye,
  settings: Settings,
};

export const AIVA_WORKER_RAIL: AivaWorkerRailItem[] = AIVA_CORE_TABS.map((tab) => ({
  id: tab.id,
  label: tab.label,
  icon: RAIL_ICONS[tab.id] ?? MessageSquare,
}));

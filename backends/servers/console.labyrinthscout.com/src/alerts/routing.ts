import type { AlertSeverity } from './types.js';

export type AlertChannelName =
  | 'telegram'
  | 'email'
  | 'sms'
  | 'whatsapp'
  | 'dashboard'
  | 'slack'
  | 'discord';

export const SEVERITY_ROUTING: Record<AlertSeverity, AlertChannelName[]> = {
  breach: ['telegram', 'whatsapp', 'email', 'sms', 'dashboard'],
  critical: ['telegram', 'whatsapp', 'email', 'sms', 'dashboard'],
  warning: ['telegram', 'email', 'dashboard'],
  info: ['dashboard'],
};

export function getChannelsForSeverity(severity: AlertSeverity): AlertChannelName[] {
  return SEVERITY_ROUTING[severity] ?? ['dashboard'];
}

import type { AlertSeverity } from './types.js';

export type AlertChannelName = 'telegram' | 'email' | 'sms' | 'dashboard' | 'slack' | 'discord';

export const SEVERITY_ROUTING: Record<AlertSeverity, AlertChannelName[]> = {
  breach: ['telegram', 'email', 'sms', 'dashboard'],
  critical: ['telegram', 'email', 'sms', 'dashboard'],
  warning: ['telegram', 'email', 'dashboard'],
  info: ['dashboard'],
};

export function getChannelsForSeverity(severity: AlertSeverity): AlertChannelName[] {
  return SEVERITY_ROUTING[severity] ?? ['dashboard'];
}

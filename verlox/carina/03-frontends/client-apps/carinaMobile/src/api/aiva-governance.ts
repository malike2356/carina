import type { GatewayAuthOptions } from '@/lib/gateway-auth';
import { mergeGatewayInit } from '@/lib/gateway-auth';
import {
  AivaApiError,
  buildAivaUrl,
  formatAivaApiError,
} from '@/api/aiva-client';

export type ScoutGovernanceStatus = 'pending' | 'connected' | 'disconnected' | string;

export interface AivaGovernanceStatus {
  scoutStatus: ScoutGovernanceStatus;
  scoutDashboardUrl: string | null;
  scoutLastHeartbeatAt: string | null;
  employeesMonitored: number;
  employeesActive: number;
  employeesSuspendedByScout: number;
  eventsLast24h: number;
  killSwitchActive: boolean;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function parseGovernanceStatus(payload: unknown): AivaGovernanceStatus {
  const root = asRecord(payload) ?? {};
  return {
    scoutStatus: asString(root.scoutStatus, 'pending'),
    scoutDashboardUrl: asString(root.scoutDashboardUrl) || null,
    scoutLastHeartbeatAt: asString(root.scoutLastHeartbeatAt) || null,
    employeesMonitored: Number(root.employeesMonitored ?? 0),
    employeesActive: Number(root.employeesActive ?? 0),
    employeesSuspendedByScout: Number(root.employeesSuspendedByScout ?? 0),
    eventsLast24h: Number(root.eventsLast24h ?? 0),
    killSwitchActive: Boolean(root.killSwitchActive),
  };
}

export function governanceStatusLabel(status: ScoutGovernanceStatus): string {
  if (status === 'connected') return 'Connected';
  if (status === 'disconnected') return 'Disconnected';
  if (status === 'pending') return 'Pending';
  return status || 'Unknown';
}

export async function fetchAivaGovernanceStatus(
  baseUrl: string,
  auth?: GatewayAuthOptions,
): Promise<AivaGovernanceStatus> {
  const response = await fetch(
    buildAivaUrl(baseUrl, '/api/aiva/scout/governance'),
    mergeGatewayInit(auth, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    }),
  );
  const text = await response.text();
  if (!response.ok) {
    throw formatAivaApiError('Aiva governance', response.status, text, response.statusText);
  }
  if (!text.trim()) {
    throw new AivaApiError(response.status, 'Aiva governance: empty response');
  }
  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch {
    throw new AivaApiError(response.status, 'Aiva governance: server returned non-JSON body', {
      body: text,
    });
  }
  return parseGovernanceStatus(payload);
}

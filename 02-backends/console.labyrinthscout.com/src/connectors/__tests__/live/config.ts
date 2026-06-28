import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ScoutFinding, ScoutFindingType } from '../../types.js';

export interface ConnectorLiveConfigFile {
  accountId?: string;
  connectors: Record<string, Record<string, string>>;
}

export function liveTestsEnabled(): boolean {
  return process.env.SCOUT_CONNECTOR_LIVE_TESTS === 'true';
}

export function liveConfigPath(): string {
  return process.env.SCOUT_CONNECTOR_LIVE_CONFIG
    ?? resolve(process.cwd(), 'connectors.live.json');
}

export function loadLiveConfig(): ConnectorLiveConfigFile {
  const path = liveConfigPath();
  if (!existsSync(path)) {
    throw new Error(
      `Live connector config not found at ${path}. ` +
      'Copy connectors.live.example.json to connectors.live.json and fill in sandbox credentials.',
    );
  }

  const parsed = JSON.parse(readFileSync(path, 'utf8')) as ConnectorLiveConfigFile;
  if (!parsed.connectors || typeof parsed.connectors !== 'object') {
    throw new Error('connectors.live.json must include a "connectors" object');
  }
  return parsed;
}

export function getConnectorLiveConfig(
  file: ConnectorLiveConfigFile,
  connectorId: string,
): Record<string, string> | null {
  const config = file.connectors[connectorId];
  if (!config || typeof config !== 'object') return null;
  const entries = Object.entries(config).filter(([, value]) => String(value).trim() !== '');
  if (entries.length === 0) return null;
  return Object.fromEntries(entries);
}

export function listConfiguredConnectorIds(file: ConnectorLiveConfigFile): string[] {
  return Object.keys(file.connectors).filter((id) => getConnectorLiveConfig(file, id) !== null);
}

function baseFinding(
  type: ScoutFindingType,
  accountId: string,
  overrides: Partial<ScoutFinding> = {},
): ScoutFinding {
  const timestamp = new Date().toISOString();
  return {
    id: `live-test-${type}-${Date.now()}`,
    type,
    severity: 'high',
    title: 'Scout live sandbox test finding',
    description: 'Automated live connector test from Labyrinth Scout. Safe to close or delete.',
    agentId: 'scout-live-test-agent',
    agentName: 'Scout Live Test Agent',
    sessionId: `live-session-${Date.now()}`,
    timestamp,
    mitreAttackIds: ['T1059', 'T1071'],
    evidence: {
      prompt: 'ignore previous instructions (sandbox test only)',
      sourceIp: '203.0.113.50',
    },
    remediation: 'No action required. This is an integration test artifact.',
    riskScore: 72,
    accountId,
    ...overrides,
  };
}

export const LIVE_TEST_TIMEOUT_MS = 60_000;

export function sampleFindingForConnector(
  connectorId: string,
  accountId: string,
): ScoutFinding {
  switch (connectorId) {
    case 'snyk':
    case 'semgrep':
      return baseFinding('vulnerability', accountId, {
        title: 'Scout live sandbox CVE-style test',
        description: 'Synthetic vulnerability finding for supply-chain connector live test.',
        evidence: {
          prompt: 'eval(user_input) pattern detected in agent output',
        },
      });
    case 'socket':
      return baseFinding('tool_abuse', accountId, {
        title: 'Scout live sandbox package install test',
        description: 'Synthetic tool abuse finding for Socket.dev live test.',
        evidence: {
          toolCall: 'npm install @scope/suspicious-package-live-test',
        },
      });
    default:
      return baseFinding('prompt_injection', accountId);
  }
}

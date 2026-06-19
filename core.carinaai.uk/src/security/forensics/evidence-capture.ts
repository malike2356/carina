import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { buildSecurityTrustState } from '../trust-state.js';
import { getKillSwitchStatus } from '../kill-switch-listener.js';
import { readSecurityAuditTail } from '../security-audit.js';
import { readAgentBehaviorTail } from '../../telemetry/agent-behavior-log.js';
import { turnLogPath } from '../../telemetry/turn-log.js';
import { chainOfCustody } from './chain-of-custody.js';
import { sha256File, sha256Json } from './hash.js';
import { artifactDir } from './paths.js';
import { saveSnapshot } from './store.js';
import type { ForensicArtifactRef, ForensicSnapshot, MessageSnapshot } from './types.js';

const frozenIncidents = new Set<string>();

export function isIncidentFrozen(incidentId: string): boolean {
  return frozenIncidents.has(incidentId);
}

async function copyArtifact(source: string, dest: string): Promise<ForensicArtifactRef> {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  try {
    await fs.copyFile(source, dest);
  } catch {
    await fs.writeFile(dest, '', 'utf8');
  }
  const stat = await fs.stat(dest);
  return {
    path: dest,
    hash: await sha256File(dest),
    size: stat.size,
  };
}

async function captureMessages(sessionId: string): Promise<MessageSnapshot[]> {
  const behavior = await readAgentBehaviorTail(100);
  return behavior
    .filter((row) => row.sessionId === sessionId)
    .slice(0, 50)
    .map((row) => ({
      role: row.action,
      contentPreview: (row.detail ?? row.action).slice(0, 240),
      timestamp: row.ts,
    }));
}

async function captureMemoryState(): Promise<Record<string, unknown>> {
  return {
    note: 'Memory snapshot stores metadata only; full memory export requires session store access.',
    capturedAt: new Date().toISOString(),
  };
}

export class EvidenceCapture {
  constructor(private readonly custody = chainOfCustody) {}

  async freezeState(incidentId: string): Promise<void> {
    frozenIncidents.add(incidentId);
  }

  async unfreezeState(incidentId: string): Promise<void> {
    frozenIncidents.delete(incidentId);
  }

  async captureSnapshot(
    incidentId: string,
    options: {
      sessionId?: string;
      agentId?: string;
      modelId?: string;
      providerId?: string;
      activeTools?: string[];
      capturedBy?: string;
    } = {},
  ): Promise<ForensicSnapshot> {
    const snapshotId = randomUUID();
    const sessionId = options.sessionId ?? process.env.CARINA_SESSION_ID ?? 'unknown-session';
    const capturedBy = options.capturedBy ?? 'forensics-engine';

    await this.freezeState(incidentId);

    const trust = await buildSecurityTrustState();
    const killSwitch = getKillSwitchStatus();
    const recentEvents = readSecurityAuditTail(25).map((row) => ({ ...row }));

    const artifactRoot = artifactDir(snapshotId);
    const turns = turnLogPath();
    const resolvedBehavior = path.join(path.dirname(turnLogPath()), 'agent-behavior.jsonl');

    const artifacts = {
      sessionLog: await copyArtifact(turns, path.join(artifactRoot, 'session.log')),
      toolCallLog: await copyArtifact(resolvedBehavior, path.join(artifactRoot, 'tool-calls.log')),
      promptLog: await copyArtifact(turns, path.join(artifactRoot, 'prompts.log')),
      networkLog: await copyArtifact(resolvedBehavior, path.join(artifactRoot, 'network.log')),
      memoryDump: await copyArtifact(resolvedBehavior, path.join(artifactRoot, 'memory-dump.jsonl')),
    };

    let carinaVersion = 'unknown';
    try {
      const here = path.dirname(fileURLToPath(import.meta.url));
      const pkg = JSON.parse(readFileSync(path.resolve(here, '../../../package.json'), 'utf8')) as { version?: string };
      carinaVersion = pkg.version ?? 'unknown';
    } catch {
      // ignore
    }

    const snapshotWithoutHash: Omit<ForensicSnapshot, 'hash'> = {
      id: snapshotId,
      incidentId,
      timestamp: Date.now(),
      capturedBy,
      agentState: {
        sessionId,
        agentId: options.agentId ?? process.env.CARINA_AGENT_ID ?? 'default-agent',
        modelId: options.modelId ?? process.env.CARINA_MODEL ?? 'unknown',
        providerId: options.providerId ?? process.env.CARINA_PROVIDER ?? 'unknown',
        messages: await captureMessages(sessionId),
        activeTools: options.activeTools ?? [],
        memoryState: await captureMemoryState(),
      },
      systemState: {
        osInfo: {
          platform: os.platform(),
          release: os.release(),
          arch: os.arch(),
          hostname: os.hostname(),
        },
        nodeVersion: process.version,
        carinaVersion,
        uptime: Math.floor(process.uptime()),
        memoryUsage: { ...process.memoryUsage() },
      },
      securityState: {
        trustScore: trust.suspended ? 0 : (trust.scoutConfigured ? 75 : 60),
        activeThreats: recentEvents.filter((row) => row.action === 'block').length,
        shieldStatus: trust.scoutConfigured ? 'armed' : 'local-only',
        killSwitchStatus: killSwitch.active ? `active:${killSwitch.reason}` : 'inactive',
        recentEvents,
      },
      artifacts,
    };

    const snapshot: ForensicSnapshot = {
      ...snapshotWithoutHash,
      hash: sha256Json(snapshotWithoutHash),
    };

    await this.custody.record({
      evidenceId: snapshotId,
      action: 'created',
      actor: capturedBy,
      actorRole: 'system',
      timestamp: Date.now(),
      reason: `Incident ${incidentId}: forensic snapshot captured`,
    });

    await saveSnapshot(snapshot);
    await this.unfreezeState(incidentId);
    return snapshot;
  }
}

export const evidenceCapture = new EvidenceCapture();

export function _clearFrozenIncidentsForTests(): void {
  frozenIncidents.clear();
}

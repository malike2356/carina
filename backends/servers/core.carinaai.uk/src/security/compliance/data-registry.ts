import fs from 'node:fs/promises';
import path from 'node:path';
import type { EvidenceItem } from './types.js';
import { dataRegistryPath } from './paths.js';

export type ProcessingActivity = {
  id: string;
  purpose: string;
  dataCategories: string[];
  dataSubjects: string[];
  recipients: string[];
  retentionDays: number;
  lawfulBasis: string;
  securityMeasures: string[];
};

export type DataProcessingRegistry = {
  version: number;
  updatedAt: string;
  controller: string;
  activities: ProcessingActivity[];
};

export const DEFAULT_DATA_PROCESSING_REGISTRY: DataProcessingRegistry = {
  version: 1,
  updatedAt: new Date().toISOString(),
  controller: 'Carina operator (configured tenant)',
  activities: [
    {
      id: 'agent-sessions',
      purpose: 'AI agent conversation processing and task execution',
      dataCategories: ['conversation content', 'tool outputs', 'session metadata'],
      dataSubjects: ['operators', 'end users'],
      recipients: ['configured LLM providers', 'internal audit logs'],
      retentionDays: 90,
      lawfulBasis: 'legitimate interest / contract',
      securityMeasures: ['RBAC', 'prompt guard', 'audit logging', 'encryption in transit'],
    },
    {
      id: 'memory-store',
      purpose: 'Episodic memory and retrieval-augmented responses',
      dataCategories: ['conversation excerpts', 'embeddings', 'memory metadata'],
      dataSubjects: ['operators', 'end users'],
      recipients: ['configured memory backend'],
      retentionDays: 365,
      lawfulBasis: 'consent / contract',
      securityMeasures: ['access controls', 'tenant isolation', 'redaction'],
    },
    {
      id: 'security-telemetry',
      purpose: 'Security monitoring, forensics, and compliance evidence',
      dataCategories: ['audit events', 'security alerts', 'incident metadata'],
      dataSubjects: ['operators'],
      recipients: ['Scout integration when enabled'],
      retentionDays: 730,
      lawfulBasis: 'legal obligation / legitimate interest',
      securityMeasures: ['immutable audit log', 'chain of custody', 'RBAC'],
    },
  ],
};

export async function loadDataProcessingRegistry(): Promise<DataProcessingRegistry> {
  try {
    const raw = JSON.parse(await fs.readFile(dataRegistryPath(), 'utf8')) as DataProcessingRegistry;
    if (Array.isArray(raw.activities) && raw.activities.length > 0) return raw;
  } catch {
    // fall through
  }
  return DEFAULT_DATA_PROCESSING_REGISTRY;
}

export async function saveDataProcessingRegistry(registry: DataProcessingRegistry): Promise<void> {
  const filePath = dataRegistryPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(registry, null, 2), { mode: 0o600 });
}

export async function getDataProcessingRegistryEvidence(now = Date.now()): Promise<EvidenceItem> {
  const registry = await loadDataProcessingRegistry();
  return {
    type: 'policy',
    description: 'Data processing registry (GDPR Article 30)',
    source: dataRegistryPath(),
    value: registry,
    collectedAt: now,
    expiresAt: now + 180 * 86_400_000,
  };
}

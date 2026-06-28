import { coreProxyEnabled, resolveCoreProxyToken, resolveCoreUrl } from '@/lib/core-proxy';
import { CYBER_TOOL_COUNT, STATIC_CYBER_TOOLS } from './cyber-tools-stub.generated';

export type CyberTool = {
  name: string;
  category: string;
  requiredTier: string;
  binary: string;
  description: string;
  triggers: string[];
  upgradeNote: string | null;
};

export type CyberToolHealth = {
  name: string;
  binary: string;
  installed: boolean;
};

export { CYBER_TOOL_COUNT };

export function cyberToolsCoreConfigured(): boolean {
  return coreProxyEnabled();
}

async function callCore(path: string): Promise<Response> {
  const base = resolveCoreUrl().replace(/\/$/, '');
  const token = resolveCoreProxyToken();
  return fetch(`${base}${path}`, {
    headers: { 'x-internal-key': token },
    cache: 'no-store',
  });
}

export async function fetchCyberToolsFromCore(): Promise<{ tools: CyberTool[]; total: number }> {
  const res = await callCore('/api/tools/cyber');
  if (!res.ok) throw new Error(`Cyber tools fetch failed: HTTP ${res.status}`);
  return res.json() as Promise<{ tools: CyberTool[]; total: number }>;
}

export async function fetchCyberToolHealthFromCore(): Promise<{
  health: CyberToolHealth[];
  installedCount: number;
  total: number;
}> {
  const res = await callCore('/api/tools/cyber/health');
  if (!res.ok) throw new Error(`Cyber tool health fetch failed: HTTP ${res.status}`);
  return res.json() as Promise<{ health: CyberToolHealth[]; installedCount: number; total: number }>;
}

export function buildCyberToolsStub(): CyberTool[] {
  return STATIC_CYBER_TOOLS;
}

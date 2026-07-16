import { createHash } from 'node:crypto';
import {
  getInstanceSandboxPolicy,
  isAllowlistEnforced,
  type SandboxPolicyMode,
} from '../kill-switch-listener.js';
import { getLoadedPolicy } from '../tool-policy.js';
import { isScoutMutualIntegrationActive } from '../scout-mode.js';
import { config } from '../../config/index.js';

export type PolicyVersionState = {
  version: string;
  updatedAt: string;
  sandboxMode: SandboxPolicyMode;
  allowlistEnforced: boolean;
  blocklistCount: number;
  allowlistCount: number;
};

let currentVersion = buildPolicyVersion();

function buildPolicyVersion(): PolicyVersionState {
  const policy = getLoadedPolicy();
  const payload = {
    sandboxMode: getInstanceSandboxPolicy(),
    allowlistEnforced: isAllowlistEnforced(),
    blocklist: policy.blocklist,
    allowlist: policy.allowlist,
    rateLimit: policy.rateLimit,
  };
  const version = createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
  return {
    version,
    updatedAt: new Date().toISOString(),
    sandboxMode: getInstanceSandboxPolicy(),
    allowlistEnforced: isAllowlistEnforced(),
    blocklistCount: policy.blocklist.length,
    allowlistCount: policy.allowlist.length,
  };
}

export function getPolicyVersionState(): PolicyVersionState {
  return currentVersion;
}

export function recordPolicyChange(
  kind: 'sandbox' | 'tool',
  payload: Record<string, unknown>,
): void {
  const previous = currentVersion.version;
  currentVersion = buildPolicyVersion();
  if (previous === currentVersion.version) return;

  if (!isScoutMutualIntegrationActive()) return;

  void reportPolicyVersionToScout(kind, payload, currentVersion).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[policy-tracker] Scout report failed:', msg);
  });
}

async function reportPolicyVersionToScout(
  kind: string,
  command: Record<string, unknown>,
  state: PolicyVersionState,
): Promise<void> {
  const { reportEvent } = await import('../scout-client.js');
  await reportEvent({
    severity: 'info',
    source: 'carina-core',
    event_type: 'policy_version_changed',
    description: `Policy version ${state.version} (${kind})`,
    instance_id: config.labyrinth.instanceId,
    metadata: {
      kind,
      version: state.version,
      sandboxMode: state.sandboxMode,
      allowlistEnforced: state.allowlistEnforced,
      command,
    },
  });
}

export function _resetPolicyVersionForTests(): void {
  currentVersion = buildPolicyVersion();
}

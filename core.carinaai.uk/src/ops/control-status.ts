import { CARINA_HOME } from '../config/paths.js';
import { listPairedDevices } from '../infrastructure/device-pairing.js';
import { listPairedNodes, listPendingPairings } from '../infrastructure/node-host/store.js';
import { readRecentNodeAudit } from '../infrastructure/node-host/audit.js';
import { sandboxStatus } from './sandbox-containers.js';
import {
  listApprovalGrants,
  listApprovalRules,
} from '../security/approval-store.js';
import { approvalPolicyEnabled } from '../security/approval-policy.js';
import { nodeHostRoutesEnabled } from '../infrastructure/node-host/routes.js';
import { sessionSandboxEnabled } from '../infrastructure/sandbox-session.js';

export type ControlStatusReport = {
  generatedAt: string;
  carinaHome: string;
  gateway: {
    nodeHostEnabled: boolean;
    hostRunning: boolean;
  };
  pairing: {
    pendingNodes: number;
    pairedNodes: number;
    pairedDevices: number;
  };
  nodes: Array<{ id: string; name: string; hostname: string; status: string }>;
  sandbox: {
    sessionSandboxEnabled: boolean;
    docker: boolean;
    containersRunning: number;
    containersTotal: number;
  };
  approvals: {
    policyEnabled: boolean;
    rules: number;
    activeGrants: number;
  };
  recentNodeAudit: number;
};

export async function buildControlStatus(options: {
  hostRunning?: boolean;
} = {}): Promise<ControlStatusReport> {
  const nodes = listPairedNodes();
  const pending = listPendingPairings();
  const devices = listPairedDevices();
  const sandbox = await sandboxStatus();
  const grants = listApprovalGrants(false);
  const rules = listApprovalRules();
  const audit = readRecentNodeAudit(20);

  return {
    generatedAt: new Date().toISOString(),
    carinaHome: CARINA_HOME,
    gateway: {
      nodeHostEnabled: nodeHostRoutesEnabled(),
      hostRunning: options.hostRunning ?? false,
    },
    pairing: {
      pendingNodes: pending.length,
      pairedNodes: nodes.length,
      pairedDevices: devices.length,
    },
    nodes: nodes.map((n) => ({
      id: n.id,
      name: n.name,
      hostname: n.hostname,
      status: n.status,
    })),
    sandbox: {
      sessionSandboxEnabled: sessionSandboxEnabled(),
      docker: sandbox.docker,
      containersRunning: sandbox.running,
      containersTotal: sandbox.total,
    },
    approvals: {
      policyEnabled: approvalPolicyEnabled(),
      rules: rules.length,
      activeGrants: grants.length,
    },
    recentNodeAudit: audit.length,
  };
}

export function formatControlStatus(report: ControlStatusReport): string {
  const lines = [
    'Control plane',
    `  node host API: ${report.gateway.nodeHostEnabled ? 'enabled' : 'disabled (CARINA_NODE_HOST_ENABLED)'}`,
    `  pairing: ${report.pairing.pairedNodes} node(s), ${report.pairing.pendingNodes} pending, ${report.pairing.pairedDevices} device(s)`,
    `  sandbox: docker=${report.sandbox.docker ? 'yes' : 'no'} ${report.sandbox.containersRunning}/${report.sandbox.containersTotal} running; session=${report.sandbox.sessionSandboxEnabled ? 'on' : 'off'}`,
    `  approvals: policy=${report.approvals.policyEnabled ? 'on' : 'off'} rules=${report.approvals.rules} grants=${report.approvals.activeGrants}`,
    `  node audit (recent): ${report.recentNodeAudit} event(s)`,
  ];
  if (report.nodes.length > 0) {
    lines.push('  nodes:');
    for (const n of report.nodes) {
      lines.push(`    ${n.id.slice(0, 8)}  ${n.name}  ${n.status}`);
    }
  }
  return lines.join('\n');
}

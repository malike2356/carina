import {
  getInstanceSandboxPolicy,
  getSessionSandboxPolicy,
  type SandboxPolicyMode,
} from './kill-switch-listener.js';
import { sessionSandboxEnabled } from '../infrastructure/sandbox-session.js';
import { openshellBackendEnabled } from '../sandbox/openshell-sandbox.js';
import { getAgentDefinition, getActiveAgentDefinition } from '../workspaces/agent-registry.js';
import type { AgentSandboxMode } from '../workspaces/types.js';

export type SandboxExecutionMode = 'host' | 'docker' | 'session' | 'openshell' | 'blocked';

export type SandboxResolution = {
  mode: SandboxExecutionMode;
  reason: string;
  policySource: 'default' | 'operator' | 'env' | 'agent';
  policyMode: SandboxPolicyMode;
};

const SANDBOX_TOOLS = new Set(['shell-exec', 'code-exec']);

function mapAgentSandboxMode(mode: AgentSandboxMode): SandboxExecutionMode | 'default' {
  if (mode === 'default') return 'default';
  return mode;
}

function resolveAgentOverride(agentId?: string): AgentSandboxMode | null {
  const id = agentId?.trim();
  const agent = id ? getAgentDefinition(id) : getActiveAgentDefinition();
  if (!agent?.sandboxMode || agent.sandboxMode === 'default') return null;
  return agent.sandboxMode;
}

function baseResolution(
  sessionId: string,
  policyMode: SandboxPolicyMode,
  policySource: SandboxResolution['policySource'],
): SandboxResolution {
  if (policyMode === 'host_blocked') {
    if (sessionSandboxEnabled()) {
      return {
        mode: 'session',
        reason: 'Operator policy blocks direct host shell; using session sandbox',
        policySource,
        policyMode,
      };
    }
    if (openshellBackendEnabled()) {
      return {
        mode: 'openshell',
        reason: 'Operator policy blocks direct host shell; using OpenShell sandbox',
        policySource,
        policyMode,
      };
    }
    return {
      mode: 'docker',
      reason: 'Operator policy blocks direct host shell; using Docker sandbox',
      policySource,
      policyMode,
    };
  }

  if (policyMode === 'docker_only') {
    return {
      mode: openshellBackendEnabled() ? 'openshell' : 'docker',
      reason: openshellBackendEnabled()
        ? 'Operator policy requires container sandbox (OpenShell backend)'
        : 'Operator policy requires Docker sandbox',
      policySource,
      policyMode,
    };
  }

  if (policyMode === 'session_only') {
    if (sessionSandboxEnabled()) {
      return {
        mode: 'session',
        reason: 'Operator policy requires session sandbox',
        policySource,
        policyMode,
      };
    }
    return {
      mode: 'blocked',
      reason: 'Session sandbox is not enabled (set CARINA_SANDBOX_SESSION=true)',
      policySource,
      policyMode,
    };
  }

  if (process.env.CARINA_DIRECT_SHELL === 'true') {
    return {
      mode: 'host',
      reason: 'CARINA_DIRECT_SHELL=true',
      policySource: 'env',
      policyMode: 'default',
    };
  }

  if (sessionSandboxEnabled()) {
    return {
      mode: 'session',
      reason: 'CARINA_SANDBOX_SESSION enabled',
      policySource: 'env',
      policyMode: 'default',
    };
  }

  if (openshellBackendEnabled()) {
    return {
      mode: 'openshell',
      reason: 'CARINA_SANDBOX_BACKEND=openshell',
      policySource: 'env',
      policyMode: 'default',
    };
  }

  return {
    mode: 'docker',
    reason: 'Default Docker sandbox (no direct shell)',
    policySource: 'default',
    policyMode: 'default',
  };
}

export function resolveSandboxExecution(
  sessionId: string,
  toolName: string,
  agentId?: string,
): SandboxResolution {
  if (!SANDBOX_TOOLS.has(toolName)) {
    return {
      mode: 'host',
      reason: 'Tool does not require sandbox routing',
      policySource: 'default',
      policyMode: 'default',
    };
  }

  const agentOverride = resolveAgentOverride(agentId);
  if (agentOverride === 'blocked') {
    return {
      mode: 'blocked',
      reason: 'Agent sandboxMode is blocked',
      policySource: 'agent',
      policyMode: 'default',
    };
  }
  if (agentOverride) {
    const mapped = mapAgentSandboxMode(agentOverride);
    if (mapped !== 'default') {
      if (mapped === 'session' && !sessionSandboxEnabled()) {
        return {
          mode: 'blocked',
          reason: 'Agent requires session sandbox but CARINA_SANDBOX_SESSION is not enabled',
          policySource: 'agent',
          policyMode: 'default',
        };
      }
      if (mapped === 'openshell' && !openshellBackendEnabled()) {
        return {
          mode: 'docker',
          reason: 'Agent requests OpenShell but CARINA_SANDBOX_BACKEND is not openshell; using Docker',
          policySource: 'agent',
          policyMode: 'default',
        };
      }
      return {
        mode: mapped,
        reason: `Agent sandboxMode=${agentOverride}`,
        policySource: 'agent',
        policyMode: 'default',
      };
    }
  }

  const sessionPolicy = getSessionSandboxPolicy(sessionId);
  const instancePolicy = getInstanceSandboxPolicy();
  const policyMode = sessionPolicy ?? instancePolicy;
  const policySource: SandboxResolution['policySource'] =
    sessionPolicy ? 'operator' : instancePolicy !== 'default' ? 'operator' : 'default';

  return baseResolution(sessionId, policyMode, policySource);
}

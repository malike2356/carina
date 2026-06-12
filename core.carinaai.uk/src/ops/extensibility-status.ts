import { acpBridgeEnabled, acpProvenanceMode, listAcpSessions } from '../infrastructure/acp-bridge/store.js';
import { acpAuthRequired, acpBridgeMode } from '../infrastructure/acp-bridge/auth.js';
import { debugProviderRoutingEnabled } from '../brain/provider-proxy-routing.js';
import { getDebugProxyState } from './debug-proxy.js';
import {
  debugCaptureEnabled,
  debugProxyProviderFilter,
  listDebugCaptures,
  listProxiedProviders,
} from './debug-proxy-capture.js';
import {
  listTaskFlows,
  summarizeTaskFlowRuns,
  taskFlowWorkerEnabled,
  taskFlowsEnabled,
  listDeliveryQueue,
} from './taskflows/index.js';
import { listExtensionHealth } from '../extensions/health.js';

export type ExtensibilityStatusReport = {
  generatedAt: string;
  taskflows: {
    enabled: boolean;
    workerEnabled: boolean;
    flows: number;
    runs: Record<string, number>;
    queuedDeliveries: number;
  };
  acp: {
    enabled: boolean;
    mode: string;
    authRequired: boolean;
    provenanceMode: string;
    sessions: number;
  };
  debugProxy: {
    running: boolean;
    captureEnabled: boolean;
    routingEnabled: boolean;
    providerFilter: string[] | null;
    proxiedProviders: string[];
    recentCaptures: number;
  };
  extensions: {
    runtimeEnabled: boolean;
    installed: number;
    enabled: number;
    unhealthy: number;
  };
};

export async function buildExtensibilityStatus(): Promise<ExtensibilityStatusReport> {
  const proxy = getDebugProxyState();
  const runs = taskFlowsEnabled() ? summarizeTaskFlowRuns() : {
    queued: 0, running: 0, succeeded: 0, failed: 0, timed_out: 0, cancelled: 0, lost: 0,
  };
  const extensions = await listExtensionHealth();
  const enabledExt = extensions.filter((e) => e.status === 'enabled');

  return {
    generatedAt: new Date().toISOString(),
    taskflows: {
      enabled: taskFlowsEnabled(),
      workerEnabled: taskFlowWorkerEnabled(),
      flows: listTaskFlows().length,
      runs,
      queuedDeliveries: taskFlowsEnabled() ? listDeliveryQueue().length : 0,
    },
    acp: {
      enabled: acpBridgeEnabled(),
      mode: acpBridgeMode(),
      authRequired: acpAuthRequired(),
      provenanceMode: acpProvenanceMode(),
      sessions: listAcpSessions().length,
    },
    debugProxy: {
      running: proxy.running,
      captureEnabled: debugCaptureEnabled(),
      routingEnabled: debugProviderRoutingEnabled(),
      providerFilter: debugProxyProviderFilter(),
      proxiedProviders: listProxiedProviders(),
      recentCaptures: listDebugCaptures(500).length,
    },
    extensions: {
      runtimeEnabled: process.env.CARINA_EXTENSIONS_ENABLED === 'true',
      installed: extensions.length,
      enabled: enabledExt.length,
      unhealthy: extensions.filter((e) => e.health === 'fail').length,
    },
  };
}

export function formatExtensibilityStatus(report: ExtensibilityStatusReport): string {
  const tf = report.taskflows;
  const lines = [
    'Extensibility / ops layer',
    `  taskflows: ${tf.enabled ? 'on' : 'off'} worker=${tf.workerEnabled ? 'on' : 'off'} `
      + `flows=${tf.flows} queued=${tf.runs.queued} running=${tf.runs.running} deliveries=${tf.queuedDeliveries}`,
    `  acp: ${report.acp.enabled ? 'on' : 'off'} mode=${report.acp.mode} sessions=${report.acp.sessions} `
      + `auth=${report.acp.authRequired ? 'required' : 'open'} provenance=${report.acp.provenanceMode}`,
    `  debug proxy: ${report.debugProxy.running ? 'running' : 'stopped'} capture=${report.debugProxy.captureEnabled ? 'on' : 'off'} `
      + `routing=${report.debugProxy.routingEnabled ? 'on' : 'off'} `
      + `providers=${report.debugProxy.proxiedProviders.join(', ') || '-'}`,
    `  extensions: runtime=${report.extensions.runtimeEnabled ? 'on' : 'off'} `
      + `installed=${report.extensions.installed} enabled=${report.extensions.enabled} unhealthy=${report.extensions.unhealthy}`,
  ];
  if (report.debugProxy.providerFilter) {
    lines.push(`  proxy filter: ${report.debugProxy.providerFilter.join(', ')}`);
  }
  return lines.join('\n');
}

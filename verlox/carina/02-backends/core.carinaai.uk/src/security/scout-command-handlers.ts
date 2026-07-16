import { randomUUID } from 'crypto';
import { config } from '../config/index.js';
import type { ScoutSignalCategory } from './scout-mutual-types.js';
import { isAgenticScoutCommand } from './scout-mutual-types.js';
import { isScoutMutualIntegrationActive } from './scout-mode.js';

let honeypotsActivated = false;

export function areScoutHoneypotsActivated(): boolean {
  return honeypotsActivated;
}

export function _resetScoutHoneypotActivation(): void {
  honeypotsActivated = false;
}

function agentId(): string {
  return `carina:${config.labyrinth.instanceId}`;
}

async function emitCommandAck(input: {
  category: ScoutSignalCategory;
  action: string;
  target: string;
  details: Record<string, unknown>;
  sessionId?: string;
  threatScore?: number;
}): Promise<void> {
  if (!isScoutMutualIntegrationActive()) return;
  const { reportScoutSignal } = await import('./scout-client.js');
  await reportScoutSignal({
    signal_id: randomUUID(),
    timestamp: new Date().toISOString(),
    agent_id: agentId(),
    category: input.category,
    action: input.action,
    target: input.target,
    details: input.details,
    threat_score: input.threatScore,
    session_id: input.sessionId,
    instance_id: config.labyrinth.instanceId,
  });
}

export async function applyAgenticScoutCommand(payload: Record<string, unknown>): Promise<boolean> {
  if (!isAgenticScoutCommand(payload.action)) return false;

  const action = payload.action === 'analyze_threat' ? 'analyse_threat' : payload.action;
  const sessionId = typeof payload.session_id === 'string' ? payload.session_id : undefined;
  const target = String(
    payload.target
    ?? payload.threat_id
    ?? payload.signal_id
    ?? sessionId
    ?? config.labyrinth.instanceId,
  );

  switch (action) {
    case 'investigate_session': {
      if (sessionId) {
        const { runInvestigation } = await import('./scout/investigation-engine.js');
        const report = await runInvestigation({
          sessionId,
          reason: typeof payload.reason === 'string' ? payload.reason : undefined,
          requestedBy: typeof payload.requested_by === 'string' ? payload.requested_by : 'scout',
        });
        if (report) return true;
      }
      await emitCommandAck({
        category: 'investigation',
        action: 'investigation_failed',
        target,
        sessionId,
        details: { command: 'investigate_session', status: 'failed', reason: 'missing session_id or scout disabled' },
      });
      return true;
    }

    case 'analyse_threat': {
      const { analyzeThreatCluster } = await import('./scout/ai-threat-analyst.js');
      const report = await analyzeThreatCluster({
        threatId: typeof payload.threat_id === 'string' ? payload.threat_id : target,
        clusterId: typeof payload.cluster_id === 'string' ? payload.cluster_id : undefined,
        sessionId,
        eventIds: Array.isArray(payload.event_ids) ? payload.event_ids.map(String) : undefined,
      });
      if (report) return true;
      await emitCommandAck({
        category: 'threat_analysis',
        action: 'threat_analysis_failed',
        target,
        sessionId,
        details: { command: 'analyse_threat', status: 'failed' },
      });
      return true;
    }

    case 'generate_report': {
      const reportType = String(payload.report_type ?? 'security_summary');
      if (reportType === 'recommendations') {
        const { runProactiveAdvisor } = await import('./scout/proactive-advisor.js');
        const recommendations = await runProactiveAdvisor();
        await emitCommandAck({
          category: 'nl_query_result',
          action: 'report_generated',
          target,
          sessionId,
          details: { command: 'generate_report', report_type: reportType, recommendations },
        });
        return true;
      }
      const { runNlSecurityQuery } = await import('./scout/nl-query-handler.js');
      const scope = String(payload.scope ?? 'instance');
      const result = await runNlSecurityQuery(
        `Security summary for ${scope} in the last 24 hours including critical events and anomalies`,
      );
      await emitCommandAck({
        category: 'nl_query_result',
        action: 'report_generated',
        target,
        sessionId,
        details: {
          command: 'generate_report',
          report_type: reportType,
          scope,
          result,
        },
      });
      return true;
    }

    case 'rotate_credentials':
      await emitCommandAck({
        category: 'recommendation',
        action: 'credential_rotation_requested',
        target,
        details: {
          command: 'rotate_credentials',
          credential_scope: payload.credential_scope ?? payload.scope ?? 'instance',
          status: 'operator_action_required',
          note: 'Automatic rotation requires configured secret backends (prompt 36 enhancement).',
        },
      });
      return true;

    case 'activate_honeypots':
      honeypotsActivated = true;
      await emitCommandAck({
        category: 'proactive_alert',
        action: 'honeypots_activated',
        target: config.labyrinth.instanceId,
        details: {
          command: 'activate_honeypots',
          status: 'active',
        },
      });
      return true;

    default:
      return false;
  }
}

import { logAdminAction } from '../audit/audit-logger.js';

interface KillSwitchAuditEntry {
  event: 'killswitch_triggered' | 'killswitch_disarmed';
  timestamp: string;
  triggered_by?: string;
  disarmed_by?: string;
  reason: string;
  agents_stopped?: number;
  stop_duration_ms?: number;
  affected_tenants?: number;
  alerts_sent?: number;
  previously_triggered_by?: string;
}

class KillSwitchAudit {
  async recordTrigger(entry: {
    triggered_by: string;
    reason: string;
    agents_stopped: number;
    stop_duration_ms: number;
    affected_tenants: number;
    alerts_sent: number;
  }): Promise<void> {
    await logAdminAction({
      tenant_id: 'system',
      action: 'kill_switch_triggered',
      detail: {
        triggered_by: entry.triggered_by,
        reason: entry.reason,
        agents_stopped: entry.agents_stopped,
        stop_duration_ms: entry.stop_duration_ms,
        affected_tenants: entry.affected_tenants,
        alerts_sent: entry.alerts_sent,
      },
      severity: 'critical',
    });
  }

  async recordDisarm(entry: {
    disarmed_by: string;
    reason: string;
    previously_triggered_by: string;
  }): Promise<void> {
    await logAdminAction({
      tenant_id: 'system',
      action: 'kill_switch_disarmed',
      detail: {
        disarmed_by: entry.disarmed_by,
        reason: entry.reason,
        previously_triggered_by: entry.previously_triggered_by,
      },
      severity: 'warning',
    });
  }

  async getHistory(limit = 50): Promise<KillSwitchAuditEntry[]> {
    const { pool } = await import('../db.js');
    const result = await pool.query<Record<string, unknown>>(
      `SELECT action, detail, timestamp
       FROM audit_log
       WHERE event_type = 'admin'
         AND action IN ('kill_switch_triggered', 'kill_switch_disarmed')
       ORDER BY timestamp DESC
       LIMIT $1`,
      [limit],
    );

    return result.rows.map((row) => {
      const detail = (row.detail as Record<string, unknown>) ?? {};
      const action = row.action as string;
      return {
        event:
          action === 'kill_switch_triggered'
            ? 'killswitch_triggered'
            : 'killswitch_disarmed',
        timestamp: new Date(row.timestamp as string).toISOString(),
        triggered_by: detail.triggered_by as string | undefined,
        disarmed_by: detail.disarmed_by as string | undefined,
        reason: (detail.reason as string) ?? '',
        agents_stopped: detail.agents_stopped as number | undefined,
        stop_duration_ms: detail.stop_duration_ms as number | undefined,
        affected_tenants: detail.affected_tenants as number | undefined,
        alerts_sent: detail.alerts_sent as number | undefined,
        previously_triggered_by: detail.previously_triggered_by as string | undefined,
      };
    });
  }
}

export const killSwitchAudit = new KillSwitchAudit();

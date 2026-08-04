import { pool } from '../db.js';
import { suspendInstance } from '../lib/instance-control.js';
import { alertDispatcher } from '../alerts/dispatcher.js';
import { killSwitchAudit } from './kill-switch-audit.js';
import { gracefulShutdown } from './graceful-shutdown.js';
import { invalidateRegulatoryClassificationCache } from '../governance/load-regulatory-classification.js';

export type KillSwitchState = 'ARMED' | 'TRIGGERED';

interface KillSwitchRow {
  state: KillSwitchState;
  triggered_by: string | null;
  reason: string | null;
  triggered_at: string | null;
}

class GlobalKillSwitch {
  private currentState: KillSwitchState = 'ARMED';
  private triggeredBy: string | null = null;
  private triggerReason: string | null = null;
  private triggeredAt: Date | null = null;

  async loadState(): Promise<void> {
    const result = await pool.query<KillSwitchRow>(
      `SELECT state, triggered_by, reason, triggered_at
       FROM killswitch_state
       ORDER BY triggered_at DESC
       LIMIT 1`,
    );
    const row = result.rows[0];
    if (!row) return;
    this.currentState = row.state;
    this.triggeredBy = row.triggered_by;
    this.triggerReason = row.reason;
    this.triggeredAt = row.triggered_at ? new Date(row.triggered_at) : null;
  }

  async persistState(
    state: KillSwitchState,
    triggeredBy: string | null,
    reason: string | null,
  ): Promise<void> {
    await pool.query(
      `INSERT INTO killswitch_state (state, triggered_by, reason, triggered_at)
       VALUES ($1, $2, $3, NOW())`,
      [state, triggeredBy, reason],
    );
    this.currentState = state;
    this.triggeredBy = triggeredBy;
    this.triggerReason = reason;
    this.triggeredAt = new Date();
  }

  getState(): KillSwitchState {
    return this.currentState;
  }

  getStatus(): {
    armed: boolean;
    triggered: boolean;
    triggered_by: string | null;
    reason: string | null;
    agents_active: number;
  } {
    return {
      armed: this.currentState === 'ARMED',
      triggered: this.currentState === 'TRIGGERED',
      triggered_by: this.triggeredBy,
      reason: this.triggerReason,
      agents_active: 0,
    };
  }

  getSnapshot(): {
    state: KillSwitchState;
    triggeredBy: string | null;
    reason: string | null;
    triggeredAt: string | null;
  } {
    return {
      state: this.currentState,
      triggeredBy: this.triggeredBy,
      reason: this.triggerReason,
      triggeredAt: this.triggeredAt ? this.triggeredAt.toISOString() : null,
    };
  }

  async trigger(adminEmail: string, reason: string): Promise<{
    triggered: boolean;
    agents_stopped: number;
    duration_ms: number;
  }> {
    if (this.currentState === 'TRIGGERED') {
      throw new Error('Kill switch already triggered');
    }

    const startTime = Date.now();
    await this.persistState('TRIGGERED', adminEmail, reason);
    await invalidateRegulatoryClassificationCache();

    const instances = await pool.query<{ id: string }>(
      `SELECT id FROM carina_instances WHERE status = 'active'`,
    );

    let stopped = 0;
    for (const row of instances.rows) {
      try {
        await gracefulShutdown.execute(row.id, reason);
      } catch {
        // If graceful fails, force-suspend directly
        await suspendInstance(row.id, reason).catch(() => {});
      }
      stopped += 1;
    }

    const durationMs = Date.now() - startTime;

    await killSwitchAudit.recordTrigger({
      triggered_by: adminEmail,
      reason,
      agents_stopped: stopped,
      stop_duration_ms: durationMs,
      affected_tenants: instances.rows.length,
      alerts_sent: 1,
    });

    await alertDispatcher.dispatch({
      id: `killswitch-${Date.now()}`,
      instance_id: 'global',
      session_id: 'system',
      event_type: 'killswitch_triggered',
      severity: 'breach',
      description: `Global kill switch triggered by ${adminEmail}. Reason: ${reason}. ${stopped} agents stopped in ${durationMs}ms.`,
      created_at: new Date(),
      acknowledged: false,
      acknowledged_by: null,
      acknowledged_at: null,
    });

    return {
      triggered: true,
      agents_stopped: stopped,
      duration_ms: durationMs,
    };
  }

  async disarm(adminEmail: string, reason: string): Promise<void> {
    await this.persistState('ARMED', null, null);
    await invalidateRegulatoryClassificationCache();

    await killSwitchAudit.recordDisarm({
      disarmed_by: adminEmail,
      reason,
      previously_triggered_by: this.triggeredBy ?? 'unknown',
    });

    await alertDispatcher.dispatch({
      id: `killswitch-disarm-${Date.now()}`,
      instance_id: 'global',
      session_id: 'system',
      event_type: 'killswitch_disarmed',
      severity: 'info',
      description: `Global kill switch disarmed by ${adminEmail}. Reason: ${reason}.`,
      created_at: new Date(),
      acknowledged: false,
      acknowledged_by: null,
      acknowledged_at: null,
    });
  }
}

export const globalKillSwitch = new GlobalKillSwitch();

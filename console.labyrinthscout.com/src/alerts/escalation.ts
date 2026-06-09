import { pool } from '../db.js';
import { alertDispatcher } from './dispatcher.js';
import * as crypto from 'crypto';
import type { AlertSeverity } from './types.js';

interface EscalationTimer {
  eventId: string;
  severity: AlertSeverity;
  instanceId: string;
  description: string;
  scheduledAt: Date;
  escalated5m: boolean;
  escalated15m: boolean;
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Schedules escalation checks for CRITICAL alerts.
 * - 5 min: if unacknowledged, resend with "UNACKNOWLEDGED; ESCALATING" prefix
 * - 15 min: if still unacknowledged, send emergency SMS
 */
export function scheduleEscalation(
  eventId: string,
  severity: AlertSeverity,
  instanceId: string,
  description: string,
): void {
  if (severity !== 'critical' && severity !== 'breach') return;

  const timer5m = setTimeout(() => {
    void checkAndEscalate(eventId, instanceId, description, '5min');
  }, 5 * 60 * 1000);

  const timer15m = setTimeout(() => {
    void checkAndEscalate(eventId, instanceId, description, '15min');
  }, 15 * 60 * 1000);

  // Store both timers under the event ID
  timers.set(`${eventId}:5m`, timer5m);
  timers.set(`${eventId}:15m`, timer15m);
}

export function cancelEscalation(eventId: string): void {
  const key5m = `${eventId}:5m`;
  const key15m = `${eventId}:15m`;

  const t5 = timers.get(key5m);
  const t15 = timers.get(key15m);
  if (t5) clearTimeout(t5);
  if (t15) clearTimeout(t15);
  timers.delete(key5m);
  timers.delete(key15m);
}

async function checkAndEscalate(
  eventId: string,
  instanceId: string,
  description: string,
  stage: '5min' | '15min',
): Promise<void> {
  try {
    const result = await pool.query<{ acknowledged: boolean }>(
      `SELECT acknowledged FROM security_events WHERE id = $1`,
      [eventId],
    );

    const row = result.rows[0];
    if (!row || row.acknowledged) return;

    const prefix = stage === '5min' ? 'UNACKNOWLEDGED; ESCALATING: ' : 'UNACKNOWLEDGED; CRITICAL ESCALATION: ';

    await alertDispatcher.dispatch({
      id: crypto.randomUUID(),
      instance_id: instanceId,
      session_id: 'system',
      event_type: 'alert_escalated',
      severity: 'critical',
      description: `${prefix}${description}`,
      created_at: new Date(),
      acknowledged: false,
      acknowledged_by: null,
      acknowledged_at: null,
    });
  } catch (err) {
    console.error('[Escalation] checkAndEscalate failed:', err);
  }
}
